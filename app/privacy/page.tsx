import { LegalLink, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy — jackshed",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 29, 2026">
      <p className="text-sm leading-relaxed text-foreground/90">
        jackshed (<LegalLink href="https://jackshed.com">jackshed.com</LegalLink>) is a free
        collection of browser-based music practice tools, built and operated by Jack Mechem as a
        personal, non-commercial project. This page explains what data jackshed collects, why, and
        what your options are. It isn&apos;t written in dense legal boilerplate on purpose — if
        anything here is unclear, use the contact method at the bottom and ask.
      </p>

      <LegalSection title="The short version">
        <p>
          Almost everything you do in jackshed — your tune lists, chord charts, recordings, and
          practice stats — stays in your own browser and is never sent anywhere. Creating an
          account is optional, and only adds an email address, a securely hashed password (or
          basic profile info from Google, if you use that instead), and — coming in a later
          update, not yet — the option to sync your practice data across your own devices. There
          are no ads, no analytics, and no trackers anywhere on this site.
        </p>
      </LegalSection>

      <LegalSection title="Data that stays on your device">
        <p>
          Every tool on jackshed — the trainers, the metronome, Chord Charts, Slow Downer, the
          Recorder — stores its data (settings, tune lists, imported chord charts, practice
          history, recordings, and any audio files you load) directly in your browser&apos;s own
          local storage, using standard browser technology (localStorage and IndexedDB). None of
          it is uploaded to jackshed&apos;s servers or seen by Jack Mechem. It stays on your device
          until you clear it yourself (through your browser&apos;s own settings, or a tool&apos;s
          own reset controls where available) — clearing your browser&apos;s site data for
          jackshed.com will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Data collected if you create an account">
        <p>Creating an account is entirely optional — every tool works fully without one.</p>
        <p>If you sign up with email and password, jackshed collects and stores:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address.</li>
          <li>
            Your password, but never in a readable form — it&apos;s run through a one-way hashing
            function before it&apos;s stored, and can&apos;t be recovered from the stored value,
            by jackshed or anyone else.
          </li>
        </ul>
        <p>If you sign in with Google instead, Google shares with jackshed:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>The email address and name associated with your Google account.</li>
          <li>
            Whatever else Google&apos;s own sign-in screen tells you it&apos;s sharing at the time
            you sign in — jackshed only requests the minimum needed to create an account (your
            email), nothing broader.
          </li>
        </ul>
        <p>
          Confirming an action by email (creating an account, changing a password, deleting an
          account) briefly stores a one-time confirmation code, hashed the same way a password is,
          which expires automatically after 15 minutes whether or not it&apos;s used.
        </p>
        <p>
          As of this writing, that&apos;s the extent of it — signing in doesn&apos;t yet sync any
          of your actual practice data (tune lists, recordings, stats) to jackshed&apos;s servers.
          That&apos;s planned for a future update; this page will be updated first when it ships.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          jackshed doesn&apos;t use advertising or tracking cookies. Browser storage is used only
          for the site to function: remembering your theme/display preferences, each tool&apos;s
          own settings, and — if you&apos;re signed in — keeping you signed in between visits.
        </p>
      </LegalSection>

      <LegalSection title="Who else sees your data">
        <p>
          jackshed doesn&apos;t sell data, and doesn&apos;t share it for advertising. A small
          number of service providers handle the account/email infrastructure on jackshed&apos;s
          behalf, only for the specific purpose named:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <LegalLink href="https://www.convex.dev/legal/privacy">Convex</LegalLink> — stores
            account data (email, hashed password, session tokens) and runs the server-side code
            that handles signing in and out.
          </li>
          <li>
            <LegalLink href="https://resend.com/legal/privacy-policy">Resend</LegalLink> — sends
            the confirmation emails jackshed emails you (account creation, password changes,
            account deletion). Your email address is shared with Resend only to deliver these.
          </li>
          <li>
            <LegalLink href="https://policies.google.com/privacy">Google</LegalLink> — handles the
            &quot;Sign in with Google&quot; option, if you choose to use it, per Google&apos;s own
            privacy practices.
          </li>
          <li>
            <LegalLink href="https://vercel.com/legal/privacy-policy">Vercel</LegalLink> — hosts
            and serves the jackshed.com site itself, and so processes standard technical
            information (like IP addresses) as part of serving web pages, the same as any web
            host.
          </li>
        </ul>
        <p>
          These providers may process data on servers located outside your own country, including
          in the United States.
        </p>
      </LegalSection>

      <LegalSection title="How long data is kept">
        <p>
          Account data is kept for as long as your account exists. You can delete your account
          yourself, at any time, from the account page — this permanently removes your email,
          password, and sign-in history from jackshed&apos;s servers. Data stored in your own
          browser is kept until you clear it yourself and isn&apos;t affected by deleting your
          account.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>Use jackshed without ever creating an account.</li>
          <li>
            View, change, or delete your account yourself, any time, from the account page —
            change or set a password, connect or disconnect Google sign-in, or permanently delete
            the account and everything tied to it.
          </li>
          <li>
            Clear your browser&apos;s local storage for jackshed.com at any time to remove
            everything stored on your device.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Passwords are stored hashed, never in plain text. Traffic to jackshed.com is encrypted
          (HTTPS). No online service can guarantee perfect security, but jackshed doesn&apos;t
          collect more than it needs to in the first place, which limits what there is to protect.
        </p>
      </LegalSection>

      <LegalSection title="Children's privacy">
        <p>
          jackshed isn&apos;t directed at children under 13, and doesn&apos;t knowingly collect
          personal information from anyone under 13. If you believe a child has created an
          account, contact us using the method below and it will be removed.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If this policy changes — most likely when practice-data syncing is added — this page
          will be updated and the date at the top will change. There&apos;s no mailing list or
          other notification beyond that.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this policy, or requests about your data (including deleting it, beyond
          what the account page already lets you do yourself), can be sent via{" "}
          <LegalLink href="https://github.com/JackMechem/jackshed.com/issues">
            GitHub issues
          </LegalLink>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
