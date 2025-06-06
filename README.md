# AppRelay - Build Distribution Platform

AppRelay is a web application designed to streamline the management and distribution of mobile app builds, catering to developers, testers, and project managers. It features version tracking, changelog analysis with Google Gemini AI, feedback collection, CI/CD build triggering, and an insightful dashboard. A key aspect of AppRelay is its dynamic backend configuration, allowing administrators to choose between a Supabase-powered backend (default) or a local setup using SQLite and the local file system. All Supabase tables are expected to reside in the `public` schema.

## Core Features

*   **User Authentication & Authorization:** Role-based access (Admin, Developer, Tester) using Supabase Authentication.
*   **Dynamic Backend Configuration:** Admins can configure the application via the `/settings` page to use:
    *   **Supabase Backend (Default):** PostgreSQL database (tables in `public` schema) and Supabase Storage for build files.
    *   **Local Backend:** SQLite database (e.g., `local.db` at project root) and local file system for build files (e.g., in a `_local_build_storage/` directory at project root).
    *   Key settings like `useSupabase` (for database), `useSupabaseStorage` (for files), `localBuildPath` (path for local build files), and `apiBaseUrl` (for constructing local download URLs) are managed through the Admin UI.
*   **Build Upload:** Supports `.ipa` (iOS) and `.apk` (Android) files. Storage location (Supabase Storage or local path) is determined by the `useSupabaseStorage` setting. Max upload size is configurable.
*   **Build Listing & Filtering:** View builds with filters. The data source (Supabase DB or local SQLite) is determined by the `useSupabase` setting.
*   **Build Detail View:** Comprehensive details, download links (from Supabase Storage or a local server endpoint via `apiBaseUrl`), QR codes.
*   **Changelog Analysis (Gemini AI):** Summarize/compare changelogs. This feature can be toggled via the `geminiEnabled` setting.
*   **Feedback System:** Users can submit and view feedback for builds. This can be toggled via the `feedbackEnabled` setting.
*   **CI/CD Integration (Simulated Manual Trigger & Repo Config):**
    *   **Manual CI Build Trigger:** Manually trigger simulated CI builds from the UI. Toggleable via `ciIntegrationEnabled` setting.
    *   **Repository Monitoring Configuration:** Admins can define a list of Git repositories (URL, default branch, platform, channel) that the system should be aware of. This configuration, managed via the Settings page (if `ciIntegrationEnabled` is true), serves as a prerequisite for future automated build triggers (e.g., via webhooks, which are not yet implemented).
*   **Dashboard:** Statistics on builds, downloads, etc. The data source adapts to the `useSupabase` setting.
*   **Force Rebuild:** Admins can create new iterations of existing builds.
*   **Secure File Management:** Build files are served either from Supabase Storage or, if local storage is used, via a secure local endpoint (`/api/local-downloads/[filename]`).
*   **Role-Protected Operations:** Sensitive actions are role-protected at the API level.
*   **Centralized Settings Management:** All key operational parameters (runtime mode, retention policies, feature toggles, UI preferences, CI repository configurations) are managed in the database (Supabase or local SQLite) and are configurable via the Admin UI (`/settings`).

## Tech Stack

*   **Frontend:** Next.js (React Framework, Pages Router), TypeScript, Tailwind CSS
*   **Backend (API Routes):** Next.js API Routes (Node.js runtime), TypeScript
*   **Authentication:** Supabase Auth
*   **Database:** Supabase (PostgreSQL - `public` schema) OR SQLite (`better-sqlite3`) - dynamically chosen based on settings.
*   **File Storage:** Supabase Storage OR Local File System - dynamically chosen based on settings.
*   **AI for Changelog Analysis:** Google Gemini API (`@google/genai` SDK)
*   **Form Processing (Backend):** `formidable` (for multipart/form-data, e.g., file uploads)
*   **Utilities:** `uuid` (for generating unique identifiers)

## Architecture Deep Dive

AppRelay leverages Next.js for both its frontend (using the Pages Router) and backend API routes. A core architectural feature is its ability to dynamically switch its backend operations (database and file storage) between a full Supabase stack and a local setup (SQLite database with local file system storage for builds). This behavior is governed by settings stored in a central `settings` table, which itself resides in Supabase (by default, or in the local SQLite DB if `APP_SETTINGS_SOURCE=local` environment variable is set for the API).

### 1. Frontend (Next.js - Pages Router)
*   **UI Components:** Built with React, TypeScript, and styled with Tailwind CSS. Reusable UI elements are in `components/ui/`.
*   **Pages:** Located in the `pages/` directory, following Next.js conventions. For example, `pages/builds/index.tsx` lists builds, and `pages/builds/[id].tsx` shows build details.
*   **Layouts & Protection:** `components/layout/AppLayout.tsx` provides the main application shell (sidebar, header). `components/layout/ProtectedRoute.tsx` handles role-based access to pages.
*   **State Management:** React Context API is used for global state like authentication (`AuthContext`), application settings (`SettingsContext`).
*   **API Interaction:** Client-side interactions with the backend are managed through functions in `services/apiClient.ts`.

### 2. Backend (Next.js API Routes)
*   **Location:** API logic resides in `pages/api/`.
*   **Functionality:** Handles data operations (CRUD for builds, feedback, settings, monitored repositories), file uploads, user authentication checks (via Supabase helpers), and interaction with external services (like Gemini AI).
*   **Dynamic Operations:** API routes read the application settings (via `lib/settingsUtil.ts` which uses `getAPISettingsDirectly`) at the beginning of request handling to determine whether to interact with Supabase services or local services (`services/localDbService.ts`).
    *   For example, when fetching builds (`pages/api/builds/index.ts`), if `settings.useSupabase` is true, it queries Supabase PostgreSQL. If false, it queries the local SQLite database via `localDbService`.
    *   Similarly, for file uploads, if `settings.useSupabaseStorage` is true, files go to Supabase Storage. If false, they are saved to the path defined in `settings.localBuildPath` and served via `/api/local-downloads/[filename].ts`.

### 3. Supabase Integration (Conditional - if `settings.useSupabase` is true)
*   **Authentication:** Supabase Auth handles user sign-up, login, and session management. User roles are stored in Supabase user metadata.
*   **Database (PostgreSQL):**
    *   All tables (`builds`, `feedbacks`, `settings`, `monitored_repositories`) are expected to be in the `public` schema.
    *   Supabase client (`lib/supabaseClient.ts`) interacts with these tables.
    *   Row Level Security (RLS) policies are defined (see SQL schema in Setup) to enforce access control.
*   **File Storage (Supabase Storage):** If `settings.useSupabaseStorage` is true, build files are uploaded to and served from a Supabase Storage bucket (typically named `builds`).

### 4. Local Mode (Conditional - if `settings.useSupabase` is false)
*   **Database (SQLite):**
    *   The `localDbService.ts` manages all interactions with an SQLite database file (e.g., `local.db` at the project root).
    *   It creates the necessary tables (`builds`, `feedbacks`, `settings`, `monitored_repositories`) if they don't exist, mirroring the Supabase schema structure.
*   **File Storage (Local File System):**
    *   If `settings.useSupabaseStorage` is false, uploaded build files are saved to the directory specified by `settings.localBuildPath` (e.g., `_local_build_storage/` at project root).
    *   These files are served through the `/api/local-downloads/[filename].ts` API endpoint. The `settings.apiBaseUrl` is used to construct the full download URL for these local files.
*   **Authentication:** Even in local mode for database/storage, user authentication might still be managed by Supabase Auth if not fully disconnected. The `AuthContext` has logic to handle a "local mock user" if `settings.useSupabase` is false, primarily for frontend UI behavior. API route protection in local mode would still rely on Supabase Auth or require a separate local auth mechanism if Supabase is entirely bypassed.

### 5. Data Flow Examples (Settings-Driven)
*   **User Login:** `AuthContext` checks `settings.useSupabase`. If true, calls Supabase Auth. If false, can set a `MOCK_LOCAL_USER`.
*   **Build Upload (`pages/upload.tsx` -> `POST /api/builds`):**
    1.  Frontend sends file and metadata.
    2.  `/api/builds` API route fetches current `AppSettings` using `getAPISettingsDirectly`.
    3.  If `settings.useSupabaseStorage` is true, the file is uploaded to Supabase Storage. URL is stored.
    4.  If `settings.useSupabaseStorage` is false, the file is saved to `settings.localBuildPath`. A local download URL (e.g., `{apiBaseUrl}/api/local-downloads/{filename}`) is constructed.
    5.  If `settings.useSupabase` is true, metadata is saved to Supabase PostgreSQL.
    6.  If `settings.useSupabase` is false, metadata is saved to local SQLite via `localDbService`.
*   **Admin Changes Settings (`pages/settings.tsx` -> `PUT /api/settings`):**
    1.  Admin UI submits changes.
    2.  `/api/settings` API route receives the payload.
    3.  It determines whether to update the `settings` table in Supabase or the local SQLite DB based on the `APP_SETTINGS_SOURCE` environment variable (or defaults to Supabase).
    4.  Client-side `SettingsContext` re-fetches settings to reflect changes globally in the UI.

This dynamic approach provides flexibility for different deployment environments or development preferences.

## Setup & Running

### Prerequisites

*   Node.js (LTS version recommended)
*   npm, yarn, or pnpm

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd apprelay-nextjs
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```
    This will also install `better-sqlite3` for local SQLite database functionality.

3.  **Environment Variables:**
    Create a `.env.local` file in the project root with the following content:
    ```env
    NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_project_anon_key"

    # Required if the 'geminiEnabled' setting is true (either in DB or default)
    API_KEY="your_google_gemini_api_key"

    # Optional: For API routes to determine the primary source of truth for settings.
    # Defaults to 'supabase' if not set. If 'local', API uses localDbService for settings.
    # APP_SETTINGS_SOURCE="local"

    # Optional: For MOCK_LOCAL_USER when useSupabase setting is false
    # NEXT_PUBLIC_MOCK_LOCAL_USER_ID="local-admin-dev"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_USERNAME="Local Dev Admin"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_EMAIL="localdev@example.com"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_ROLE="Admin"
    ```
    Replace placeholder values with your actual Supabase project URL, anon key, and Gemini API key.

4.  **Supabase Setup (If using Supabase backend):**
    *   Go to [Supabase](https://supabase.com/) and create a new project.
    *   Under "Authentication" -> "Providers", ensure "Email" provider is enabled.
    *   Under "Authentication" -> "URL Configuration", set your Site URL (e.g., `http://localhost:3000` for local development).
    *   **Database Tables:** Go to "SQL Editor" and run the SQL schema provided below. This schema creates all necessary tables (`builds`, `feedbacks`, `settings`, `monitored_repositories`) in the `public` schema and sets up Row Level Security (RLS) policies.
    *   **Storage Bucket:** Go to "Storage" and create a new public bucket named `builds`. This bucket will be used if the `useSupabaseStorage` setting is true.

    **SQL Schema for Supabase Tables (all in `public` schema):**
    ```sql
    -- Enable UUID extension if not already enabled
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- builds table (in public schema)
    CREATE TABLE public.builds (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "appName" TEXT NOT NULL,
        "versionName" TEXT NOT NULL,
        "versionCode" TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('iOS', 'Android')),
        channel TEXT NOT NULL CHECK (channel IN ('Beta', 'Staging', 'Production')),
        changelog TEXT NOT NULL,
        "previousChangelog" TEXT,
        "uploadDate" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "buildStatus" TEXT NOT NULL CHECK ("buildStatus" IN ('Success', 'Failed', 'In Progress')),
        "commitHash" TEXT,
        "downloadUrl" TEXT, -- Can be Supabase Storage URL or local download endpoint URL
        "qrCodeUrl" TEXT,
        size TEXT,
        "fileName" TEXT, -- Original filename or UUID for local storage
        "fileType" TEXT,
        "downloadCount" INTEGER DEFAULT 0 NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('Manual Upload', 'CI Pipeline')),
        "ciBuildId" TEXT,
        "pipelineStatus" TEXT CHECK ("pipelineStatus" IN ('Success', 'Failed', 'In Progress')),
        "ciLogsUrl" TEXT,
        "triggeredBy" TEXT,
        "allowedUDIDs" JSONB -- For iOS UDID restrictions
    );
    COMMENT ON COLUMN public.builds."fileName" IS 'Filename in storage (Supabase key or local filename)';
    CREATE INDEX idx_builds_platform_channel ON public.builds (platform, channel);
    CREATE INDEX idx_builds_upload_date ON public.builds ("uploadDate" DESC);
    CREATE INDEX idx_builds_appname ON public.builds ("appName");

    -- feedbacks table (in public schema)
    CREATE TABLE public.feedbacks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        build_id UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX idx_feedbacks_build_id ON public.feedbacks (build_id);
    CREATE INDEX idx_feedbacks_created_at ON public.feedbacks (created_at DESC);

    -- settings table for dynamic application configurations (in public schema)
    -- This table should ideally contain only ONE row, representing the global settings.
    -- The API layer (getAPISettingsDirectly, /api/settings) handles creating this row with defaults if it doesn't exist.
    CREATE TABLE IF NOT EXISTS public.settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Runtime environment settings
        "useSupabase" BOOLEAN NOT NULL DEFAULT TRUE,
        "useSupabaseStorage" BOOLEAN NOT NULL DEFAULT TRUE,
        "apiBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:3000', -- Used for constructing URLs, e.g., local downloads
        "localBuildPath" TEXT NOT NULL DEFAULT '_local_build_storage', -- Relative path for local build file storage

        -- Build management & retention
        "maxBuildsPerGroup" INTEGER NOT NULL DEFAULT 10, -- Max builds per (appName, platform, channel) group
        "deletePolicy" TEXT NOT NULL DEFAULT 'CIOnly' CHECK ("deletePolicy" IN ('CIOnly', 'All')), -- Policy for deleting excess builds
        "enableAutoClean" BOOLEAN NOT NULL DEFAULT TRUE, -- Master switch for build retention policy

        -- Feature toggles
        "geminiEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable Gemini AI for changelog analysis
        "feedbackEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable user feedback system
        "notifyOnNewBuild" BOOLEAN NOT NULL DEFAULT FALSE, -- Enable/disable notifications on new build uploads
        "ciIntegrationEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable CI/CD related features
        "buildApprovalRequired" BOOLEAN NOT NULL DEFAULT FALSE, -- Example: future feature for build approval workflows

        -- UI & functional parameters
        "qrCodeMode" TEXT NOT NULL DEFAULT 'DownloadLink' CHECK ("qrCodeMode" IN ('DownloadLink', 'BuildDetail')), -- What QR codes link to
        "defaultChannel" TEXT NOT NULL DEFAULT 'Beta' CHECK ("defaultChannel" IN ('Beta', 'Staging', 'Production')), -- Default channel for new uploads
        "maxUploadSizeMB" INTEGER NOT NULL DEFAULT 200, -- Maximum allowed file size for uploads
        "uiTheme" TEXT NOT NULL DEFAULT 'dark' CHECK ("uiTheme" IN ('light', 'dark', 'system')), -- UI theme preference

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Timestamp of last update
    );
    COMMENT ON TABLE public.settings IS 'Stores a single row of global application settings. API ensures only one row exists or creates defaults.';

    -- Monitored Repositories table for CI auto-trigger configuration (in public schema)
    CREATE TABLE IF NOT EXISTS public.monitored_repositories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repo_url TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL,
        default_platform TEXT NOT NULL CHECK (default_platform IN ('iOS', 'Android')),
        default_channel TEXT NOT NULL CHECK (default_channel IN ('Beta', 'Staging', 'Production')),
        auto_trigger_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Whether new commits should automatically trigger a build
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ -- Timestamp of last update
    );
    COMMENT ON TABLE public.monitored_repositories IS 'Stores Git repositories to monitor for automated CI build triggers. This configuration is a prerequisite for future webhook-based automation.';
    CREATE INDEX idx_monitored_repo_url ON public.monitored_repositories (repo_url);

    -- Grant usage on the public schema (often default, but explicit can be good)
    GRANT USAGE ON SCHEMA public TO anon, authenticated;

    -- Grant appropriate permissions on tables to anon and authenticated roles.
    -- RLS policies will further restrict access.
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; -- Adjust as needed, RLS is primary guard


    -- ROW LEVEL SECURITY (RLS)
    -- Ensure RLS is enabled for all relevant tables.
    ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.monitored_repositories ENABLE ROW LEVEL SECURITY;

    -- Helper function to get claims from JWT (useful for RLS policies)
    CREATE OR REPLACE FUNCTION public.get_my_claim(claim TEXT) RETURNS JSONB LANGUAGE SQL STABLE AS $$
      SELECT COALESCE(current_setting('request.jwt.claims', true)::JSONB -> claim, NULL);
    $$;
    COMMENT ON FUNCTION public.get_my_claim(TEXT) IS 'Retrieves a specific claim from the current user''s JWT.';

    -- Policies for 'builds' table
    CREATE POLICY "Authenticated users can view builds" ON public.builds FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Devs/Admins can create builds" ON public.builds FOR INSERT TO authenticated
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text IN ('Developer', 'Admin')));
    CREATE POLICY "Admins can update builds" ON public.builds FOR UPDATE TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    CREATE POLICY "Admins can delete builds" ON public.builds FOR DELETE TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));

    -- Policies for 'feedbacks' table
    CREATE POLICY "Authenticated users can insert feedback" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can view feedback" ON public.feedbacks FOR SELECT TO authenticated USING (true);
    -- Add update/delete policies for feedback if needed, e.g., only by the user who created it or by an admin.

    -- Policies for 'settings' table
    -- Admins can manage (SELECT, INSERT, UPDATE, DELETE) the settings.
    -- Note: INSERT is typically handled by the API to create defaults if no row exists.
    CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    -- Authenticated users can read settings (needed for SettingsContext to function for all logged-in users).
    CREATE POLICY "Authenticated users can read settings" ON public.settings FOR SELECT TO authenticated USING (true);


    -- Policies for 'monitored_repositories' table
    CREATE POLICY "Admins can manage monitored repositories" ON public.monitored_repositories FOR ALL TO authenticated
        USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
        WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    -- Optionally, allow authenticated (non-admin) users to read if needed by other parts of the app.
    -- CREATE POLICY "Authenticated can read monitored repositories" ON public.monitored_repositories FOR SELECT TO authenticated USING (true);

    -- Ensure the roles have 'public' in their search_path (usually default, but good to confirm)
    ALTER ROLE authenticated SET search_path = public, "$user";
    ALTER ROLE anon SET search_path = public, "$user";
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

6.  **Initial Configuration (Important!):**
    *   **Sign up** for a new user account. The first user might not be an Admin by default. You may need to manually update the user's role in your Supabase dashboard (Authentication -> Users -> select user -> User App Metadata) to `Admin` to access the settings page:
        ```json
        {
          "role": "Admin",
          "username": "YourChosenUsername"
        }
        ```
    *   **Log in as Admin** and navigate to the `/settings` page.
    *   The application will attempt to load settings. If running Supabase and the `settings` table is empty, the API (`/api/settings` backed by `lib/settingsUtil.ts`) should automatically create the first settings row using `DEFAULT_SETTINGS` from `types.ts`.
    *   Review and **save the settings** even if they look correct to ensure the row is properly established.
    *   **If using local storage mode** (`APP_SETTINGS_SOURCE="local"` in `.env.local` or the `useSupabase` setting is false):
        *   The `localDbService.ts` will create `local.db` in your project root if it doesn't exist and initialize the schema, including the `settings` table with defaults.
        *   Ensure the directory specified in `localSettings.localBuildPath` (e.g., `_local_build_storage/` by default) exists and is writable by the Node.js process.
        *   **Add `local.db` and your `localBuildPath` directory (e.g., `_local_build_storage/`) to your `.gitignore` file.**
            ```gitignore
            # Local database and storage
            local.db
            local.db-journal
            _local_build_storage/
            ```

## Project Structure Highlights

*   **`pages/`**: Contains Next.js pages and API routes.
    *   **`pages/api/`**: Backend API logic.
        *   `pages/api/builds/`: API routes for build management.
        *   `pages/api/feedback/`: API routes for feedback.
        *   `pages/api/settings/index.ts`: API for fetching and updating global application settings.
        *   `pages/api/ci/repositories/`: APIs for managing monitored CI repositories.
        *   `pages/api/local-downloads/[filename].ts`: API endpoint for serving build files when local file storage is used.
    *   `pages/index.tsx`: Dashboard page.
    *   `pages/builds/index.tsx`: Build listing page.
    *   `pages/builds/[id].tsx`: Build detail page.
    *   `pages/upload.tsx`: Build upload page.
    *   `pages/settings.tsx`: Admin page for managing application settings.
    *   `pages/login.tsx`, `pages/signup.tsx`: Authentication pages.
*   **`components/`**: React components.
    *   `components/ui/`: Generic UI elements (Button, Input, Modal, etc.).
    *   `components/layout/`: Layout components like `AppLayout.tsx` and `ProtectedRoute.tsx`.
*   **`contexts/`**: React context providers.
    *   `AuthContext.tsx`: Manages user authentication state.
    *   `SettingsContext.tsx`: Provides global application settings to the frontend.
*   **`services/`**: Client-side and server-side services.
    *   `apiClient.ts`: Functions for frontend to call backend APIs.
    *   `geminiService.ts`: Interacts with the Google Gemini API.
    *   `authService.ts`: Supabase authentication helper functions.
    *   `settingsService.ts`: Client-side service to fetch settings for the `SettingsContext`.
    *   `localDbService.ts`: Service for all interactions with the local SQLite database (`local.db`) when not using Supabase for the database. Handles schema creation, CRUD for builds, feedback, settings, and monitored repositories.
    *   `notificationService.ts`: Placeholder for sending notifications.
*   **`lib/`**: Core utility/library files.
    *   `supabaseClient.ts`: Initializes the Supabase client.
    *   `settingsUtil.ts`: Server-side utility (`getAPISettingsDirectly`) for API routes to fetch current application settings (from Supabase or local DB).
*   **`types.ts`**: TypeScript type definitions and enums for the application. Includes `DEFAULT_SETTINGS`.
*   **`public/`**: Static assets.
*   **`styles/`**: Global CSS and Tailwind CSS configuration.
*   **`local.db`** (Example, if using local DB): The SQLite database file. **Should be in `.gitignore`**.
*   **`_local_build_storage/`** (Example, if using local file storage): Directory for stored build files. **Should be in `.gitignore`**.

This dynamic and configurable architecture makes AppRelay adaptable to various deployment scenarios and development preferences, from a fully Supabase-managed cloud deployment to a completely local development and testing environment.
```