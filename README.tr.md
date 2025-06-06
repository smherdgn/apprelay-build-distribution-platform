# AppRelay - Derleme Dağıtım Platformu

AppRelay, mobil uygulama derlemelerini (build) yönetme ve dağıtma sürecini kolaylaştırmak için tasarlanmış, geliştiricilere, test kullanıcılarına ve proje yöneticilerine hitap eden bir web uygulamasıdır. Sürüm takibi, Google Gemini AI ile değişiklik günlüğü (changelog) analizi, geri bildirim toplama, CI/CD derleme tetikleme ve genel bir bakış paneli gibi özelliklere sahiptir. AppRelay'in önemli bir yönü, yöneticilerin Supabase tabanlı bir arka uç (varsayılan) ile SQLite ve yerel dosya sistemini kullanan yerel bir kurulum arasında seçim yapmasına olanak tanıyan dinamik arka uç yapılandırmasıdır. Tüm Supabase tablolarının `public` şemasında olması beklenmektedir.

## Temel Özellikler

*   **Kullanıcı Kimlik Doğrulama ve Yetkilendirme:** Supabase Kimlik Doğrulama kullanarak rol tabanlı erişim (Admin, Geliştirici, Test Kullanıcısı).
*   **Dinamik Arka Uç Yapılandırması:** Adminler, `/settings` sayfası üzerinden uygulamayı şu şekillerde kullanmak üzere yapılandırabilir:
    *   **Supabase Arka Ucu (Varsayılan):** PostgreSQL veritabanı (`public` şemasındaki tablolar) ve derleme dosyaları için Supabase Storage.
    *   **Yerel Arka Uç:** SQLite veritabanı (örn. proje kökünde `local.db`) ve derleme dosyaları için yerel dosya sistemi (örn. proje kökünde bir `_local_build_storage/` dizininde).
    *   `useSupabase` (veritabanı için), `useSupabaseStorage` (dosyalar için), `localBuildPath` (yerel derleme dosyaları için yol) ve `apiBaseUrl` (yerel indirme URL'leri oluşturmak için) gibi temel ayarlar Admin arayüzü üzerinden yönetilir.
*   **Derleme Yükleme:** `.ipa` (iOS) ve `.apk` (Android) dosyalarını destekler. Depolama konumu (`useSupabaseStorage` ayarına göre Supabase Storage veya yerel yol) belirlenir. Maksimum yükleme boyutu yapılandırılabilir.
*   **Derleme Listeleme ve Filtreleme:** Derlemeleri filtrelerle görüntüleme. Veri kaynağı (`useSupabase` ayarına göre Supabase DB veya yerel SQLite) belirlenir.
*   **Derleme Detay Sayfası:** Kapsamlı detaylar, indirme bağlantıları (`apiBaseUrl` üzerinden Supabase Storage veya yerel sunucu uç noktasından), QR kodları.
*   **Değişiklik Günlüğü Analizi (Gemini AI):** Değişiklik günlüklerini özetleme/karşılaştırma. Bu özellik `geminiEnabled` ayarıyla açılıp kapatılabilir.
*   **Geri Bildirim Sistemi:** Kullanıcılar derlemeler için geri bildirim gönderebilir ve görüntüleyebilir. Bu özellik `feedbackEnabled` ayarıyla açılıp kapatılabilir.
*   **CI/CD Entegrasyonu (Simüle Edilmiş Manuel Tetikleme ve Depo Yapılandırması):**
    *   **Manuel CI Derleme Tetikleme:** Kullanıcı arayüzünden manuel olarak simüle edilmiş CI derlemelerini tetikleme. `ciIntegrationEnabled` ayarıyla yönetilir.
    *   **Depo İzleme Yapılandırması:** Adminler, sistemin haberdar olması gereken Git depolarının (URL, varsayılan branch, platform, kanal) bir listesini tanımlayabilir. Ayarlar sayfası üzerinden yönetilen bu yapılandırma (`ciIntegrationEnabled` true ise), gelecekteki otomatik derleme tetikleyicileri (örn. webhook'lar aracılığıyla, henüz uygulanmadı) için bir ön koşul görevi görür.
*   **Gösterge Paneli (Dashboard):** Derlemeler, indirmeler vb. hakkında istatistikler. Veri kaynağı `useSupabase` ayarına uyum sağlar.
*   **Yeniden Derlemeyi Zorla (Force Rebuild):** Adminler mevcut derlemelerin yeni iterasyonlarını oluşturabilir.
*   **Güvenli Dosya Yönetimi:** Derleme dosyaları Supabase Storage'dan veya yerel depolama kullanılıyorsa güvenli bir yerel uç nokta (`/api/local-downloads/[filename].ts`) üzerinden sunulur.
*   **Rol Korumalı İşlemler:** Hassas eylemler API düzeyinde rol korumalıdır.
*   **Merkezi Ayar Yönetimi:** Tüm temel operasyonel parametreler (çalışma zamanı modu, saklama politikaları, özellik geçişleri, kullanıcı arayüzü tercihleri, CI depo yapılandırmaları) veritabanında (Supabase veya yerel SQLite) yönetilir ve Admin arayüzü (`/settings`) üzerinden yapılandırılabilir.

## Teknoloji Yığını

*   **Frontend:** Next.js (React Framework, Pages Router), TypeScript, Tailwind CSS
*   **Backend (API Rotaları):** Next.js API Rotaları (Node.js runtime), TypeScript
*   **Kimlik Doğrulama:** Supabase Auth
*   **Veritabanı:** Supabase (PostgreSQL - `public` şeması) VEYA SQLite (`better-sqlite3`) - ayarlara göre dinamik olarak seçilir.
*   **Dosya Depolama:** Supabase Storage VEYA Yerel Dosya Sistemi - ayarlara göre dinamik olarak seçilir.
*   **Değişiklik Günlüğü Analizi için Yapay Zeka:** Google Gemini API (`@google/genai` SDK)
*   **Form İşleme (Backend):** `formidable` (multipart/form-data, örn. dosya yüklemeleri için)
*   **Yardımcı Araçlar:** `uuid` (benzersiz tanımlayıcılar üretmek için)

## Mimari Derinlemesine Bakış

AppRelay, hem frontend (Pages Router kullanarak) hem de backend API rotaları için Next.js'i kullanır. Temel bir mimari özelliği, backend işlemlerini (veritabanı ve dosya depolama) tam bir Supabase yığını ile yerel bir kurulum (derlemeler için yerel dosya sistemi depolamalı SQLite veritabanı) arasında dinamik olarak değiştirebilme yeteneğidir. Bu davranış, merkezi bir `settings` tablosunda saklanan ayarlarla yönetilir; bu tablo varsayılan olarak Supabase'de (veya API için `APP_SETTINGS_SOURCE=local` ortam değişkeni ayarlanmışsa yerel SQLite DB'de) bulunur.

### 1. Frontend (Next.js - Pages Router)
*   **UI Bileşenleri:** React, TypeScript ile oluşturulmuş ve Tailwind CSS ile stillendirilmiştir. Yeniden kullanılabilir UI öğeleri `components/ui/` içindedir.
*   **Sayfalar:** Next.js kurallarına uygun olarak `pages/` dizininde bulunur. Örneğin, `pages/builds/index.tsx` derlemeleri listeler ve `pages/builds/[id].tsx` derleme ayrıntılarını gösterir.
*   **Düzenler ve Koruma:** `components/layout/AppLayout.tsx` ana uygulama kabuğunu (kenar çubuğu, başlık) sağlar. `components/layout/ProtectedRoute.tsx` sayfalara rol tabanlı erişimi yönetir.
*   **Durum Yönetimi:** React Context API, kimlik doğrulama (`AuthContext`), uygulama ayarları (`SettingsContext`) gibi global durumlar için kullanılır.
*   **API Etkileşimi:** Backend ile istemci tarafı etkileşimleri `services/apiClient.ts` içindeki fonksiyonlar aracılığıyla yönetilir.

### 2. Backend (Next.js API Rotaları)
*   **Konum:** API mantığı `pages/api/` içinde bulunur.
*   **İşlevsellik:** Veri işlemlerini (derlemeler, geri bildirimler, ayarlar, izlenen depolar için CRUD), dosya yüklemelerini, kullanıcı kimlik doğrulama kontrollerini (Supabase yardımcıları aracılığıyla) ve harici servislerle (Gemini AI gibi) etkileşimi yönetir.
*   **Dinamik İşlemler:** API rotaları, Supabase servisleriyle mi yoksa yerel servislerle (`services/localDbService.ts`) mi etkileşimde bulunulacağını belirlemek için istek işlemenin başında uygulama ayarlarını (`lib/settingsUtil.ts` aracılığıyla `getAPISettingsDirectly` kullanarak) okur.
    *   Örneğin, derlemeleri alırken (`pages/api/builds/index.ts`), `settings.useSupabase` true ise, Supabase PostgreSQL'i sorgular. False ise, `localDbService` aracılığıyla yerel SQLite veritabanını sorgular.
    *   Benzer şekilde, dosya yüklemeleri için, `settings.useSupabaseStorage` true ise, dosyalar Supabase Storage'a gider. False ise, `settings.localBuildPath` içinde tanımlanan yola kaydedilir ve `/api/local-downloads/[filename].ts` üzerinden sunulur.

### 3. Supabase Entegrasyonu (Koşullu - `settings.useSupabase` true ise)
*   **Kimlik Doğrulama:** Supabase Auth, kullanıcı kaydı, giriş ve oturum yönetimini gerçekleştirir. Kullanıcı rolleri Supabase kullanıcı meta verilerinde saklanır.
*   **Veritabanı (PostgreSQL):**
    *   Tüm tabloların (`builds`, `feedbacks`, `settings`, `monitored_repositories`) `public` şemasında olması beklenir.
    *   Supabase istemcisi (`lib/supabaseClient.ts`) bu tablolarla etkileşime girer.
    *   Satır Düzeyi Güvenlik (RLS) politikaları (Kurulumdaki SQL şemasına bakın) erişim kontrolünü uygulamak için tanımlanmıştır.
*   **Dosya Depolama (Supabase Storage):** `settings.useSupabaseStorage` true ise, derleme dosyaları bir Supabase Storage kovasına (genellikle `builds` olarak adlandırılır) yüklenir ve buradan sunulur.

### 4. Yerel Mod (Koşullu - `settings.useSupabase` false ise)
*   **Veritabanı (SQLite):**
    *   `localDbService.ts`, bir SQLite veritabanı dosyasıyla (örn. proje kökünde `local.db`) tüm etkileşimleri yönetir.
    *   Gerekli tabloları (`builds`, `feedbacks`, `settings`, `monitored_repositories`) yoksa oluşturur ve Supabase şema yapısını yansıtır.
*   **Dosya Depolama (Yerel Dosya Sistemi):**
    *   `settings.useSupabaseStorage` false ise, yüklenen derleme dosyaları `settings.localBuildPath` tarafından belirtilen dizine (örn. proje kökünde `_local_build_storage/`) kaydedilir.
    *   Bu dosyalar `/api/local-downloads/[filename].ts` API uç noktası aracılığıyla sunulur. `settings.apiBaseUrl`, bu yerel dosyalar için tam indirme URL'sini oluşturmak için kullanılır.
*   **Kimlik Doğrulama:** Veritabanı/depolama için yerel modda bile, kullanıcı kimlik doğrulaması, tamamen bağlantısı kesilmemişse Supabase Auth tarafından yönetilebilir. `AuthContext`, `settings.useSupabase` false ise, öncelikle frontend UI davranışı için bir "yerel sahte kullanıcıyı" yönetme mantığına sahiptir. Yerel moddaki API rota koruması yine Supabase Auth'a dayanır veya Supabase tamamen atlanırsa ayrı bir yerel kimlik doğrulama mekanizması gerektirir.

### 5. Veri Akış Örnekleri (Ayarlara Dayalı)
*   **Kullanıcı Girişi:** `AuthContext`, `settings.useSupabase` değerini kontrol eder. True ise, Supabase Auth'u çağırır. False ise, bir `MOCK_LOCAL_USER` ayarlayabilir.
*   **Derleme Yükleme (`pages/upload.tsx` -> `POST /api/builds`):**
    1.  Frontend dosya ve meta verileri gönderir.
    2.  `/api/builds` API rotası, `getAPISettingsDirectly` kullanarak mevcut `AppSettings`'i alır.
    3.  `settings.useSupabaseStorage` true ise, dosya Supabase Storage'a yüklenir. URL saklanır.
    4.  `settings.useSupabaseStorage` false ise, dosya `settings.localBuildPath`'e kaydedilir. Yerel bir indirme URL'si (örn. `{apiBaseUrl}/api/local-downloads/{filename}`) oluşturulur.
    5.  `settings.useSupabase` true ise, meta veriler Supabase PostgreSQL'e kaydedilir.
    6.  `settings.useSupabase` false ise, meta veriler `localDbService` aracılığıyla yerel SQLite'a kaydedilir.
*   **Admin Ayarları Değiştirir (`pages/settings.tsx` -> `PUT /api/settings`):**
    1.  Admin arayüzü değişiklikleri gönderir.
    2.  `/api/settings` API rotası yükü alır.
    3.  `APP_SETTINGS_SOURCE` ortam değişkenine (veya varsayılan olarak Supabase'e) göre Supabase'deki `settings` tablosunu mu yoksa yerel SQLite DB'yi mi güncelleyeceğini belirler.
    4.  İstemci tarafı `SettingsContext`, değişiklikleri kullanıcı arayüzünde global olarak yansıtmak için ayarları yeniden alır.

Bu dinamik yaklaşım, farklı dağıtım ortamları veya geliştirme tercihleri için esneklik sağlar.

## Kurulum ve Çalıştırma

### Önkoşullar

*   Node.js (LTS sürümü önerilir)
*   npm, yarn veya pnpm

### Kurulum Adımları

1.  **Depoyu klonlayın:**
    ```bash
    git clone <depo-urlsi>
    cd apprelay-nextjs
    ```
2.  **Bağımlılıkları yükleyin:**
    ```bash
    npm install
    # veya
    # yarn install
    # veya
    # pnpm install
    ```
    Bu ayrıca yerel SQLite veritabanı işlevselliği için `better-sqlite3`'ü de yükleyecektir.

3.  **Ortam Değişkenleri:**
    Proje kökünde `.env.local` adında bir dosya oluşturun ve aşağıdaki içeriği ekleyin:
    ```env
    NEXT_PUBLIC_SUPABASE_URL="sizin_supabase_proje_url_adresiniz"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="sizin_supabase_proje_anon_anahtarınız"

    # 'geminiEnabled' ayarı true ise (DB'de veya varsayılan olarak) gereklidir
    API_KEY="sizin_google_gemini_api_anahtarınız"

    # İsteğe bağlı: API rotalarının ayarlar için birincil doğruluk kaynağını belirlemesi için.
    # Ayarlanmazsa varsayılan olarak 'supabase' kullanılır. 'local' ise, API ayarlar için localDbService kullanır.
    # APP_SETTINGS_SOURCE="local"

    # İsteğe bağlı: useSupabase ayarı false olduğunda MOCK_LOCAL_USER için
    # NEXT_PUBLIC_MOCK_LOCAL_USER_ID="yerel-admin-dev"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_USERNAME="Yerel Geliştirici Admin"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_EMAIL="yereldev@example.com"
    # NEXT_PUBLIC_MOCK_LOCAL_USER_ROLE="Admin"
    ```
    Yer tutucu değerleri gerçek Supabase proje URL'niz, anon anahtarınız ve Gemini API anahtarınızla değiştirin.

4.  **Supabase Kurulumu (Supabase arka ucunu kullanıyorsanız):**
    *   [Supabase](https://supabase.com/) adresine gidin ve yeni bir proje oluşturun.
    *   "Authentication" -> "Providers" altında, "Email" sağlayıcısının etkin olduğundan emin olun.
    *   "Authentication" -> "URL Configuration" altında, Site URL'nizi ayarlayın (örn. yerel geliştirme için `http://localhost:3000`).
    *   **Veritabanı Tabloları:** "SQL Editor" bölümüne gidin ve aşağıda verilen SQL şemasını çalıştırın. Bu şema, `public` şemasında gerekli tüm tabloları (`builds`, `feedbacks`, `settings`, `monitored_repositories`) oluşturur ve Satır Düzeyi Güvenlik (RLS) politikalarını ayarlar.
    *   **Storage Kovası (Bucket):** "Storage" bölümüne gidin ve `builds` adında genel (public) bir kova oluşturun. Bu kova, `useSupabaseStorage` ayarı true ise kullanılacaktır.

    **Supabase Tabloları için SQL Şeması (tümü `public` şemasında):**
    ```sql
    -- UUID uzantısını etkinleştirin (eğer zaten etkin değilse)
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- builds tablosu (public şemasında)
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
        "downloadUrl" TEXT, -- Supabase Storage URL'si veya yerel indirme uç noktası URL'si olabilir
        "qrCodeUrl" TEXT,
        size TEXT,
        "fileName" TEXT, -- Depolamadaki dosya adı (Supabase anahtarı veya yerel dosya adı)
        "fileType" TEXT,
        "downloadCount" INTEGER DEFAULT 0 NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('Manual Upload', 'CI Pipeline')),
        "ciBuildId" TEXT,
        "pipelineStatus" TEXT CHECK ("pipelineStatus" IN ('Success', 'Failed', 'In Progress')),
        "ciLogsUrl" TEXT,
        "triggeredBy" TEXT,
        "allowedUDIDs" JSONB -- iOS UDID kısıtlamaları için
    );
    COMMENT ON COLUMN public.builds."fileName" IS 'Depolamadaki dosya adı (Supabase anahtarı veya yerel dosya adı)';
    CREATE INDEX idx_builds_platform_channel ON public.builds (platform, channel);
    CREATE INDEX idx_builds_upload_date ON public.builds ("uploadDate" DESC);
    CREATE INDEX idx_builds_appname ON public.builds ("appName");

    -- feedbacks tablosu (public şemasında)
    CREATE TABLE public.feedbacks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        build_id UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX idx_feedbacks_build_id ON public.feedbacks (build_id);
    CREATE INDEX idx_feedbacks_created_at ON public.feedbacks (created_at DESC);

    -- Dinamik uygulama yapılandırmaları için settings tablosu (public şemasında)
    -- Bu tablo ideal olarak yalnızca global ayarları temsil eden TEK bir satır içermelidir.
    -- API katmanı (getAPISettingsDirectly, /api/settings) mevcut değilse bu satırı varsayılanlarla oluşturmayı yönetir.
    CREATE TABLE IF NOT EXISTS public.settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Çalışma zamanı ortam ayarları
        "useSupabase" BOOLEAN NOT NULL DEFAULT TRUE,
        "useSupabaseStorage" BOOLEAN NOT NULL DEFAULT TRUE,
        "apiBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:3000', -- URL oluşturmak için kullanılır, örn. yerel indirmeler
        "localBuildPath" TEXT NOT NULL DEFAULT '_local_build_storage', -- Yerel derleme dosyası depolaması için göreli yol

        -- Derleme yönetimi ve saklama
        "maxBuildsPerGroup" INTEGER NOT NULL DEFAULT 10, -- (appName, platform, channel) grubu başına maksimum derleme
        "deletePolicy" TEXT NOT NULL DEFAULT 'CIOnly' CHECK ("deletePolicy" IN ('CIOnly', 'All')), -- Fazla derlemeleri silme politikası
        "enableAutoClean" BOOLEAN NOT NULL DEFAULT TRUE, -- Derleme saklama politikası için ana anahtar

        -- Özellik geçişleri
        "geminiEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- Değişiklik günlüğü analizi için Gemini AI'yi etkinleştirme/devre dışı bırakma
        "feedbackEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- Kullanıcı geri bildirim sistemini etkinleştirme/devre dışı bırakma
        "notifyOnNewBuild" BOOLEAN NOT NULL DEFAULT FALSE, -- Yeni derleme yüklemelerinde bildirimleri etkinleştirme/devre dışı bırakma
        "ciIntegrationEnabled" BOOLEAN NOT NULL DEFAULT TRUE, -- CI/CD ile ilgili özellikleri etkinleştirme/devre dışı bırakma
        "buildApprovalRequired" BOOLEAN NOT NULL DEFAULT FALSE, -- Örnek: derleme onay iş akışları için gelecekteki özellik

        -- UI ve işlevsel parametreler
        "qrCodeMode" TEXT NOT NULL DEFAULT 'DownloadLink' CHECK ("qrCodeMode" IN ('DownloadLink', 'BuildDetail')), -- QR kodlarının neye bağlantı verdiği
        "defaultChannel" TEXT NOT NULL DEFAULT 'Beta' CHECK ("defaultChannel" IN ('Beta', 'Staging', 'Production')), -- Yeni yüklemeler için varsayılan kanal
        "maxUploadSizeMB" INTEGER NOT NULL DEFAULT 200, -- Yüklemeler için izin verilen maksimum dosya boyutu
        "uiTheme" TEXT NOT NULL DEFAULT 'dark' CHECK ("uiTheme" IN ('light', 'dark', 'system')), -- UI tema tercihi

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Son güncelleme zaman damgası
    );
    COMMENT ON TABLE public.settings IS 'Global uygulama ayarlarının tek bir satırını saklar. API, yalnızca bir satırın var olmasını veya varsayılanları oluşturmasını sağlar.';

    -- CI otomatik tetikleme yapılandırması için monitored_repositories tablosu (public şemasında)
    CREATE TABLE IF NOT EXISTS public.monitored_repositories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repo_url TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL,
        default_platform TEXT NOT NULL CHECK (default_platform IN ('iOS', 'Android')),
        default_channel TEXT NOT NULL CHECK (default_channel IN ('Beta', 'Staging', 'Production')),
        auto_trigger_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Yeni commitlerin otomatik olarak bir CI derlemesini tetikleyip tetiklemeyeceği
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ -- Son güncelleme zaman damgası
    );
    COMMENT ON TABLE public.monitored_repositories IS 'Otomatik CI derleme tetikleyicileri için izlenecek Git depolarını saklar. Bu yapılandırma, gelecekteki webhook tabanlı otomasyon için bir ön koşuldur.';
    CREATE INDEX idx_monitored_repo_url ON public.monitored_repositories (repo_url);

    -- public şeması üzerinde kullanım izni ver (genellikle varsayılan, ancak açıkça belirtmek iyi olabilir)
    GRANT USAGE ON SCHEMA public TO anon, authenticated;

    -- Tablolarda anon ve authenticated rollerine uygun izinleri ver.
    -- RLS politikaları erişimi daha da kısıtlayacaktır.
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; -- Gerektiği gibi ayarlayın, RLS birincil korumadır


    -- SATIR DÜZEYİ GÜVENLİK (RLS)
    -- İlgili tüm tablolar için RLS'nin etkinleştirildiğinden emin olun.
    ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.monitored_repositories ENABLE ROW LEVEL SECURITY;

    -- JWT'den talepleri almak için yardımcı fonksiyon (RLS politikaları için kullanışlı)
    CREATE OR REPLACE FUNCTION public.get_my_claim(claim TEXT) RETURNS JSONB LANGUAGE SQL STABLE AS $$
      SELECT COALESCE(current_setting('request.jwt.claims', true)::JSONB -> claim, NULL);
    $$;
    COMMENT ON FUNCTION public.get_my_claim(TEXT) IS 'Mevcut kullanıcının JWT''sinden belirli bir talebi alır.';

    -- 'builds' tablosu için politikalar
    CREATE POLICY "Authenticated users can view builds" ON public.builds FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Devs/Admins can create builds" ON public.builds FOR INSERT TO authenticated
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text IN ('Developer', 'Admin')));
    CREATE POLICY "Admins can update builds" ON public.builds FOR UPDATE TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    CREATE POLICY "Admins can delete builds" ON public.builds FOR DELETE TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));

    -- 'feedbacks' tablosu için politikalar
    CREATE POLICY "Authenticated users can insert feedback" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can view feedback" ON public.feedbacks FOR SELECT TO authenticated USING (true);
    -- Gerekirse geri bildirim için güncelleme/silme politikaları ekleyin, örn. yalnızca oluşturan kullanıcı veya bir admin tarafından.

    -- 'settings' tablosu için politikalar
    -- Adminler ayarları yönetebilir (SELECT, INSERT, UPDATE, DELETE).
    -- Not: INSERT genellikle API tarafından, satır yoksa varsayılanları oluşturmak için yönetilir.
    CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL TO authenticated
      USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
      WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    -- Kimliği doğrulanmış kullanıcılar ayarları okuyabilir (SettingsContext'in tüm oturum açmış kullanıcılar için çalışması gerekir).
    CREATE POLICY "Authenticated users can read settings" ON public.settings FOR SELECT TO authenticated USING (true);


    -- 'monitored_repositories' tablosu için politikalar
    CREATE POLICY "Admins can manage monitored repositories" ON public.monitored_repositories FOR ALL TO authenticated
        USING (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'))
        WITH CHECK (((get_my_claim('user_metadata'::text)) ->> 'role'::text = 'Admin'));
    -- İsteğe bağlı olarak, uygulamanın diğer bölümleri tarafından gerekirse kimliği doğrulanmış (admin olmayan) kullanıcıların okumasına izin verin.
    -- CREATE POLICY "Authenticated can read monitored repositories" ON public.monitored_repositories FOR SELECT TO authenticated USING (true);

    -- Roller için search_path'in 'public' içerdiğinden emin olun (genellikle varsayılan, ancak onaylamak iyi olur)
    ALTER ROLE authenticated SET search_path = public, "$user";
    ALTER ROLE anon SET search_path = public, "$user";
    ```

5.  **Geliştirme sunucusunu çalıştırın:**
    ```bash
    npm run dev
    # veya
    # yarn dev
    # veya
    # pnpm dev
    ```
    Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

6.  **İlk Yapılandırma (Önemli!):**
    *   Yeni bir kullanıcı hesabı için **kaydolun**. İlk kullanıcı varsayılan olarak Admin olmayabilir. Ayarlar sayfasına erişmek için kullanıcının rolünü Supabase panonuzda (Authentication -> Users -> kullanıcı seç -> User App Metadata) manuel olarak `Admin` olarak güncellemeniz gerekebilir:
        ```json
        {
          "role": "Admin",
          "username": "SectiginizKullaniciAdi"
        }
        ```
    *   **Admin olarak giriş yapın** ve `/settings` sayfasına gidin.
    *   Uygulama ayarları yüklemeye çalışacaktır. Supabase çalıştırılıyorsa ve `settings` tablosu boşsa, API (`/api/settings`, `lib/settingsUtil.ts` tarafından desteklenir) `types.ts` içindeki `DEFAULT_SETTINGS` kullanarak ilk ayarlar satırını otomatik olarak oluşturmalıdır.
    *   Doğru görünseler bile ayarları gözden geçirin ve satırın düzgün bir şekilde oluşturulduğundan emin olmak için **ayarları kaydedin**.
    *   **Yerel depolama modunu kullanıyorsanız** (`.env.local` dosyasında `APP_SETTINGS_SOURCE="local"` veya `useSupabase` ayarı false ise):
        *   `localDbService.ts`, proje kökünüzde `local.db` yoksa oluşturacak ve `settings` tablosu dahil şemayı varsayılanlarla başlatacaktır.
        *   `localSettings.localBuildPath` içinde belirtilen dizinin (örn. varsayılan olarak `_local_build_storage/`) mevcut olduğundan ve Node.js işlemi tarafından yazılabilir olduğundan emin olun.
        *   **`local.db` ve `localBuildPath` dizininizi (örn. `_local_build_storage/`) `.gitignore` dosyanıza ekleyin.**
            ```gitignore
            # Yerel veritabanı ve depolama
            local.db
            local.db-journal
            _local_build_storage/
            ```

## Proje Yapısı Önemli Noktalar

*   **`pages/`**: Next.js sayfalarını ve API rotalarını içerir.
    *   **`pages/api/`**: Backend API mantığı.
        *   `pages/api/builds/`: Derleme yönetimi için API rotaları.
        *   `pages/api/feedback/`: Geri bildirim için API rotaları.
        *   `pages/api/settings/index.ts`: Global uygulama ayarlarını almak ve güncellemek için API.
        *   `pages/api/ci/repositories/`: İzlenen CI depolarını yönetmek için API'ler.
        *   `pages/api/local-downloads/[filename].ts`: Yerel dosya depolaması kullanıldığında derleme dosyalarını sunmak için API uç noktası.
    *   `pages/index.tsx`: Gösterge paneli sayfası.
    *   `pages/builds/index.tsx`: Derleme listeleme sayfası.
    *   `pages/builds/[id].tsx`: Derleme detay sayfası.
    *   `pages/upload.tsx`: Derleme yükleme sayfası.
    *   `pages/settings.tsx`: Uygulama ayarlarını yönetmek için Admin sayfası.
    *   `pages/login.tsx`, `pages/signup.tsx`: Kimlik doğrulama sayfaları.
*   **`components/`**: React bileşenleri.
    *   `components/ui/`: Genel UI öğeleri (Button, Input, Modal, vb.).
    *   `components/layout/`: `AppLayout.tsx` ve `ProtectedRoute.tsx` gibi düzen bileşenleri.
*   **`contexts/`**: React context sağlayıcıları.
    *   `AuthContext.tsx`: Kullanıcı kimlik doğrulama durumunu yönetir.
    *   `SettingsContext.tsx`: Frontend'e global uygulama ayarlarını sağlar.
*   **`services/`**: İstemci tarafı ve sunucu tarafı servisleri.
    *   `apiClient.ts`: Frontend'in backend API'lerini çağırması için fonksiyonlar.
    *   `geminiService.ts`: Google Gemini API ile etkileşime girer.
    *   `authService.ts`: Supabase kimlik doğrulama yardımcı fonksiyonları.
    *   `settingsService.ts`: `SettingsContext` için ayarları almak üzere istemci tarafı servisi.
    *   `localDbService.ts`: Veritabanı için Supabase kullanılmadığında yerel SQLite veritabanı (`local.db`) ile tüm etkileşimler için servis. Şema oluşturma, derlemeler, geri bildirimler, ayarlar ve izlenen depolar için CRUD işlemlerini yönetir.
    *   `notificationService.ts`: Bildirim göndermek için yer tutucu.
*   **`lib/`**: Temel yardımcı/kütüphane dosyaları.
    *   `supabaseClient.ts`: Supabase istemcisini başlatır.
    *   `settingsUtil.ts`: API rotalarının mevcut uygulama ayarlarını (Supabase veya yerel DB'den) alması için sunucu tarafı yardımcı programı (`getAPISettingsDirectly`).
*   **`types.ts`**: Uygulama için TypeScript tip tanımları ve enumları. `DEFAULT_SETTINGS` içerir.
*   **`public/`**: Statik varlıklar.
*   **`styles/`**: Global CSS ve Tailwind CSS yapılandırması.
*   **`local.db`** (Örnek, yerel DB kullanılıyorsa): SQLite veritabanı dosyası. **`.gitignore` içinde olmalıdır**.
*   **`_local_build_storage/`** (Örnek, yerel dosya depolaması kullanılıyorsa): Depolanan derleme dosyaları için dizin. **`.gitignore` içinde olmalıdır**.

Bu dinamik ve yapılandırılabilir mimari, AppRelay'i tam Supabase tarafından yönetilen bir bulut dağıtımından tamamen yerel bir geliştirme ve test ortamına kadar çeşitli dağıtım senaryolarına ve geliştirme tercihlerine uyarlanabilir hale getirir.
```