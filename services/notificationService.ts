
import { AppVersion, Feedback, User } from '../types'; // Removed UserRole as it's only used in commented out code

// --- User Management and Preferences (Placeholders) ---

async function getSubscribedUsersForBuild(build: AppVersion): Promise<User[]> {
  console.log(`[NotificationService] Called getSubscribedUsersForBuild for: ${build.appName} v${build.versionName}. User subscription logic needs implementation.`);
  // MOCK: Return a dummy admin user for testing if no real users are set up.
  // const mockAdminUser: User = { id: 'admin-user-for-email', username: 'NotificationAdmin', email: 'admin-notify@example.com', role: UserRole.Admin };
  // return [mockAdminUser]; // Uncomment for testing if you don't have real user subscription logic
  return [];
}

async function getSubscribedUsersForFeedback(build: AppVersion, _feedback: Feedback): Promise<User[]> {
  console.log(`[NotificationService] Called getSubscribedUsersForFeedback for build: ${build.appName} v${build.versionName}. User subscription logic needs implementation.`);
  // const mockAdminUser: User = { id: 'admin-user-for-email', username: 'NotificationAdmin', email: 'admin-notify@example.com', role: UserRole.Admin };
  // return [mockAdminUser];
  return [];
}


// --- Email Notification (Placeholder) ---
async function sendEmail(to: string, subject: string, htmlBody: string, _textBody: string): Promise<void> {
  console.log(`[NotificationService] Email sending service not implemented. Would send email to: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  HTML Body (first 100 chars): ${htmlBody.substring(0, 100)}...`);
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`[NotificationService] Placeholder email to ${to} considered "sent".`);
}

const sendNewBuildEmailNotification = async (user: User, build: AppVersion) => {
  if (!user.email) {
    console.warn(`[NotificationService] User ${user.username} has no email for new build notification.`);
    return;
  }
  const subject = `New Build Uploaded: ${build.appName} v${build.versionName}`;
  const buildUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/builds/${build.id}`;
  const textBody = `
A new build for ${build.appName} is available:
Version: ${build.versionName} (${build.versionCode})
Platform: ${build.platform}
Channel: ${build.channel}
Changelog:
${build.changelog.substring(0, 200)}${build.changelog.length > 200 ? '...' : ''}

Download or view details: ${buildUrl}
  `;
  const htmlBody = `
    <p>A new build for <strong>${build.appName}</strong> is available:</p>
    <ul>
      <li><strong>Version:</strong> ${build.versionName} (${build.versionCode})</li>
      <li><strong>Platform:</strong> ${build.platform}</li>
      <li><strong>Channel:</strong> ${build.channel}</li>
    </ul>
    <p><strong>Changelog Summary:</strong></p>
    <pre>${build.changelog.substring(0, 300)}${build.changelog.length > 300 ? '...' : ''}</pre>
    <p><a href="${buildUrl}">View Details & Download</a></p>
    <hr>
    <p><small>You are receiving this email because you are subscribed to notifications for public.</small></p>
  `;
  await sendEmail(user.email, subject, htmlBody, textBody);
};

const sendNewFeedbackEmailNotification = async (user: User, feedback: Feedback, build: AppVersion) => {
  if (!user.email) {
    console.warn(`[NotificationService] User ${user.username} has no email for new feedback notification.`);
    return;
  }
  const subject = `New Feedback for ${build.appName} v${build.versionName}`;
  const buildUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/builds/${build.id}`;
  const textBody = `
New feedback submitted for ${build.appName} v${build.versionName} by ${feedback.user}:
---
${feedback.comment}
---
View build details: ${buildUrl}
  `;
  const htmlBody = `
    <p>New feedback submitted for <strong>${build.appName} v${build.versionName}</strong> by <em>${feedback.user}</em>:</p>
    <blockquote>${feedback.comment}</blockquote>
    <p><a href="${buildUrl}">View Build Details</a></p>
    <hr>
    <p><small>You are receiving this email because you are subscribed to notifications for public.</small></p>
  `;
  await sendEmail(user.email, subject, htmlBody, textBody);
};


// --- Web Push Notification (Placeholder) ---
const sendWebPush = async (_userSubscription: any, title: string, _body: string, _url?: string): Promise<void> => {
  console.log(`[NotificationService] Web push service not implemented. Would send push: ${title}`);
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log(`[NotificationService] Placeholder web push for title "${title}" considered "sent".`);
};

const sendNewBuildWebPushNotification = async (_user: User, build: AppVersion) => {
  const userPushSubscription = null; 
  if (userPushSubscription) {
    const title = `${build.appName} v${build.versionName} Available!`;
    const body = `Channel: ${build.channel} | Platform: ${build.platform}. Click to see details.`;
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/builds/${build.id}`;
    await sendWebPush(userPushSubscription, title, body, url);
  }
};

const sendNewFeedbackWebPushNotification = async (_user: User, feedback: Feedback, build: AppVersion) => {
  const userPushSubscription = null; 
  if (userPushSubscription) {
    const title = `New Feedback: ${build.appName} v${build.versionName}`;
    const body = `By ${feedback.user}: "${feedback.comment.substring(0, 50)}..."`;
    const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/builds/${build.id}`;
    await sendWebPush(userPushSubscription, title, body, url);
  }
};


// --- Public API for Triggering Notifications ---
/**
 * Notifies relevant users about a new build.
 * The decision to call this function should be gated by the 'notifyOnNewBuild' setting in the calling API route.
 * @param build The newly uploaded build.
 */
export const notifyNewBuild = async (build: AppVersion): Promise<void> => {
  console.log(`[NotificationService] 'notifyNewBuild' called for ${build.appName} v${build.versionName}.`);
  const subscribedUsers = await getSubscribedUsersForBuild(build);

  if (subscribedUsers.length === 0) {
    console.log(`[NotificationService] No subscribed users found for new build ${build.id} notifications (or user fetching not implemented).`);
    return;
  }

  for (const user of subscribedUsers) {
    const shouldSendEmail = true; 
    const shouldSendPush = false; 

    if (shouldSendEmail) {
      await sendNewBuildEmailNotification(user, build).catch(err => 
        console.error(`[NotificationService] Error sending email for new build to ${user.email}:`, err)
      );
    }
    if (shouldSendPush) {
      await sendNewBuildWebPushNotification(user, build).catch(err => 
        console.error(`[NotificationService] Error sending web push for new build to ${user.username}:`, err)
      );
    }
  }
  console.log(`[NotificationService] Finished processing notifications for new build ${build.id}.`);
};

/**
 * Notifies relevant users about new feedback.
 * The decision to call this function could be gated by a similar feedback notification setting if implemented.
 * @param feedback The newly submitted feedback.
 * @param build The build associated with the feedback.
 */
export const notifyNewFeedback = async (feedback: Feedback, build: AppVersion): Promise<void> => {
  console.log(`[NotificationService] 'notifyNewFeedback' called for build: ${build.appName} v${build.versionName}.`);
  const subscribedUsers = await getSubscribedUsersForFeedback(build, feedback);
  
  if (subscribedUsers.length === 0) {
    console.log(`[NotificationService] No subscribed users found for new feedback on build ${build.id} (or user fetching not implemented).`);
    return;
  }

  for (const user of subscribedUsers) {
    const shouldSendEmail = true; 
    const shouldSendPush = false; 

    if (shouldSendEmail) {
      await sendNewFeedbackEmailNotification(user, feedback, build).catch(err => 
        console.error(`[NotificationService] Error sending email for new feedback to ${user.email}:`, err)
      );
    }
    if (shouldSendPush) {
      await sendNewFeedbackWebPushNotification(user, feedback, build).catch(err => 
        console.error(`[NotificationService] Error sending web push for new feedback to ${user.username}:`, err)
      );
    }
  }
  console.log(`[NotificationService] Finished processing notifications for new feedback on build ${build.id}.`);
};