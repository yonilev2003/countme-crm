export const metadata = {
  title: "Terms of Service — CountMe",
  description: "Terms of use for the internal CountMe management tool",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        <strong>Last updated:</strong> 16 May 2026
      </p>

      <h2>1. Acceptance of terms</h2>
      <p>
        By signing in to CountMe (the &quot;App&quot;) you agree to these
        Terms of Service. If you do not agree, do not use the App.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The App is provided as an internal tool for authorised members of
        the CountMe team. Access is granted by an administrator and may
        be revoked at any time without notice. The App is not offered to
        the public and is not intended for use by anyone outside the
        team.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree that you will not:</p>
      <ul>
        <li>Share your account credentials with anyone outside the team.</li>
        <li>
          Use the App to store unlawful content, malware, or material that
          infringes the rights of others.
        </li>
        <li>
          Attempt to bypass access controls, scrape data, or reverse
          engineer the App.
        </li>
        <li>
          Use the App in any way that disrupts service for other team
          members.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of the content you create in the App (tasks,
        messages, documents, etc.). You grant the App a non-exclusive
        licence to store, display, and share that content with other
        authorised team members so the App can function as intended.
      </p>

      <h2>5. Third-party services</h2>
      <p>
        The App integrates with Google (Calendar, Drive, OAuth), Supabase
        (database + storage), Vercel (hosting), and Anthropic (AI
        features). Your use of these integrations is also subject to those
        providers&apos; terms. We are not responsible for actions of
        third-party services.
      </p>

      <h2>6. AI-generated content</h2>
      <p>
        The App uses Claude (by Anthropic) to parse natural-language dates
        and to answer help questions. AI outputs may contain errors. Do
        not rely on AI-generated content for legally or financially
        critical decisions without independent verification.
      </p>

      <h2>7. No warranty</h2>
      <p>
        The App is provided &quot;as is&quot; without warranty of any
        kind, express or implied. We do not guarantee that the App will
        be available without interruption, error-free, or that any data
        will be preserved indefinitely.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, CountMe and its operators
        shall not be liable for any indirect, incidental, special, or
        consequential damages arising from your use of the App, including
        but not limited to loss of data or business interruption.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access at any time, with or
        without cause. You may stop using the App at any time. Upon
        termination, your data will be handled in accordance with the
        Privacy Policy.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Israel.
        Disputes arising from these Terms will be resolved exclusively in
        the courts of Tel Aviv, Israel.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes
        will be communicated through the App. Continued use after changes
        constitutes acceptance.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:countme5555@gmail.com">countme5555@gmail.com</a>.
      </p>
    </>
  );
}
