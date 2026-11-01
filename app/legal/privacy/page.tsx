import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Riftbound Deckbuilder",
  description: "How Riftbound Deckbuilder handles your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        This policy explains what information Riftbound Deckbuilder stores, what
        is public, and how you can ask us to delete your data. We keep the
        amount of data we collect to what the app needs to work.
      </p>

      <h2>1. What we store</h2>
      <ul>
        <li>
          <strong>Account details</strong> from your sign-in provider (Google or
          GitHub): your email address, name, and avatar image.
        </li>
        <li>
          <strong>Collection data</strong>: the cards you own, quantities, and
          your collection settings, including visibility.
        </li>
        <li>
          <strong>Deck data</strong>: decks you build, and decks you choose to
          publish.
        </li>
        <li>
          <strong>Follow relationships</strong>: which users you follow or
          connect with in the app.
        </li>
        <li>
          <strong>Session data</strong>: information needed to keep you signed
          in, managed through Neon Auth.
        </li>
      </ul>
      <p>
        We do not receive or store your password from Google or GitHub.
      </p>

      <h2>2. What is public</h2>
      <ul>
        <li>
          <strong>Collections</strong> are private by default. If you set a
          collection&apos;s visibility to link, anyone with the link can view
          it. If you set it to public, anyone can find and view it.
        </li>
        <li>
          <strong>Published decks</strong> are visible to other users.
        </li>
        <li>
          Your display name and avatar may appear next to content you make
          public. Your email address is not shown publicly.
        </li>
      </ul>
      <p>
        You can change a collection&apos;s visibility at any time. Changing it to
        private stops new visitors from viewing it, although copies that others
        already saw or saved cannot be recalled.
      </p>

      <h2>3. What we do not do</h2>
      <p>
        We do not sell your personal information or your collection and deck
        data.
      </p>

      <h2>4. Service providers</h2>
      <p>
        We use the following service providers to run the app. They process data
        on our behalf:
      </p>
      <ul>
        <li>
          <strong>Neon</strong>, for our database and authentication
          (Neon Auth).
        </li>
        <li>
          <strong>Vercel</strong>, for hosting the app.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        The app uses only session cookies, which are needed to keep you signed
        in. We do not use tracking or advertising cookies.
      </p>

      <h2>6. Card data and Riot Games</h2>
      <p>
        Card data is provided through the official Riot Games API. The app does
        not display play or win-rate statistics.
      </p>
      <p>
        Riot account linking is not offered at this time. If we add it in the
        future, linked information may become visible to other users. Any such
        feature will require your explicit opt-in before anything linked is made
        public.
      </p>

      <h2>7. Keeping and deleting your data</h2>
      <p>
        We keep your data for as long as your account exists. To request deletion
        of your account and associated collection, deck, and follow data, email{" "}
        {/* TODO: replace contact@example.com with the real contact address before launch. */}
        <a href="mailto:contact@example.com">contact@example.com</a> from the
        email address on your account. We will act on verified deletion requests
        without undue delay.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we make material
        changes, we will update the &quot;Last updated&quot; date and make a
        reasonable effort to let users know.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions or requests about your privacy can be sent to{" "}
        {/* TODO: replace contact@example.com with the real contact address before launch. */}
        <a href="mailto:contact@example.com">contact@example.com</a>.
      </p>
    </>
  );
}
