export const metadata = {
  title: "Privacy Policy — CountMe",
  description: "How CountMe handles personal data",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Last updated:</strong> 16 May 2026
      </p>

      <p>
        CountMe (the &quot;App&quot;, &quot;we&quot;, &quot;us&quot;) is an
        internal team-management tool used by the staff of CountMe. This
        Privacy Policy explains what information we collect, why we collect
        it, how we store and protect it, and your rights regarding it.
      </p>

      <h2>1. Who this policy applies to</h2>
      <p>
        This policy applies only to authorised members of the CountMe team
        who have been granted access to the App by an administrator. The App
        is not offered to the general public.
      </p>

      <h2>2. Information we collect</h2>
      <p>When you sign in with Google, we collect:</p>
      <ul>
        <li>
          <strong>Profile basics:</strong> your Google account email, full
          name, and avatar (via the OAuth scopes <code>email</code>,
          <code>profile</code>, <code>openid</code>).
        </li>
        <li>
          <strong>Google Calendar data:</strong> when you grant calendar
          access (scope <code>calendar</code>), the App reads and writes
          calendar events on your behalf so that your work events stay in
          sync with your personal Google Calendar. The App stores a Google
          refresh token to maintain this sync in the background.
        </li>
        <li>
          <strong>Google Drive files:</strong> when an administrator
          connects the shared team Drive (scope <code>drive.file</code>),
          the App can create, read, modify, and delete files only inside
          the dedicated folder it created (named &quot;הנהלת CountMe — מסמכים&quot;).
          It cannot see any other files in the connected Drive account.
        </li>
        <li>
          <strong>App content you create:</strong> contacts, tasks, chat
          messages, documents you upload, calendar events, and projects
          you author inside the App.
        </li>
      </ul>

      <h2>3. How we use the information</h2>
      <ul>
        <li>To authenticate you and personalise the interface.</li>
        <li>
          To synchronise calendar events bidirectionally between the App
          and your Google Calendar, and to send event invitations on your
          behalf.
        </li>
        <li>
          To mirror documents to the team&apos;s shared Google Drive folder
          and to reflect Drive changes back into the App.
        </li>
        <li>
          To enable team collaboration features (chat, task assignment,
          shared calendar).
        </li>
      </ul>

      <h2>4. Limited use of Google user data</h2>
      <p>
        CountMe&apos;s use and transfer to any other app of information
        received from Google APIs adheres to{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not sell or transfer
        Google user data to third parties, do not use it for advertising,
        and do not allow humans to read it except (a) with your explicit
        consent, (b) to comply with applicable law, or (c) for security
        purposes such as investigating abuse.
      </p>

      <h2>5. Where the data is stored</h2>
      <ul>
        <li>
          <strong>Application database:</strong> Supabase (PostgreSQL),
          hosted in AWS ap-northeast-1 (Tokyo). Row-level security
          restricts access so that each user sees only data they are
          authorised to view.
        </li>
        <li>
          <strong>Document blobs:</strong> Supabase Storage (private
          bucket), with signed URLs valid for 60 seconds at a time.
        </li>
        <li>
          <strong>AI features:</strong> when you use the natural-language
          date parser for tasks or the in-app help assistant, the
          relevant text is sent to Anthropic (Claude) for processing.
          Anthropic does not retain the data for model training. See{" "}
          <a
            href="https://www.anthropic.com/legal/commercial-terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Anthropic&apos;s commercial terms
          </a>
          .
        </li>
      </ul>

      <h2>6. Data retention and deletion</h2>
      <p>
        We retain your data for as long as your account is active. If you
        want your data deleted, contact the administrator at{" "}
        <a href="mailto:countme5555@gmail.com">countme5555@gmail.com</a>.
        Within 30 days we will delete your profile, your authored content,
        and any stored OAuth tokens. Note that data shared with other
        users (e.g. messages you sent, tasks you assigned) may remain
        visible to those users.
      </p>

      <h2>7. Security</h2>
      <p>
        We use HTTPS for all network traffic, encrypt OAuth tokens at rest,
        and restrict database access via row-level security and per-user
        authentication. We do not guarantee absolute security but follow
        modern best practices for a private internal tool.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You can at any time revoke the App&apos;s access to your Google
        account at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://myaccount.google.com/permissions
        </a>
        . Doing so will disable calendar and Drive sync but will not
        delete data already stored in the App; for that contact the
        administrator.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The
        &quot;Last updated&quot; date at the top will reflect the most
        recent revision. Continued use of the App after a change
        constitutes acceptance of the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href="mailto:countme5555@gmail.com">countme5555@gmail.com</a>.
      </p>
    </>
  );
}
