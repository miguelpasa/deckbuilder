import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Riftbound Deckbuilder",
  description: "The rules for using Riftbound Deckbuilder.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        These terms explain the rules for using Riftbound Deckbuilder (the
        &quot;app&quot;, &quot;we&quot;, or &quot;us&quot;). The short version:
        the app is free, we want it to be useful to Riftbound players, and we
        ask you to use it respectfully. Please read the full terms below.
      </p>

      <h2>1. Accepting these terms</h2>
      <p>
        By creating an account or using the app, you agree to these terms. If
        you don&apos;t agree, please don&apos;t use the app.
      </p>

      <h2>2. What the app is</h2>
      <p>
        Riftbound Deckbuilder is a free, fan-made web app that helps Riftbound
        players track their card collection, see how close they are to building
        featured tournament decklists, share collections by link or JSON file,
        and see which missing cards friends might be able to lend. Card data is
        provided through the official Riot Games API.
      </p>

      <h2>3. Accounts</h2>
      <ul>
        <li>
          You sign in with Google or GitHub through our authentication provider,
          Neon Auth. We don&apos;t see or store your sign-in provider password.
        </li>
        <li>
          You are responsible for activity on your account and for keeping your
          sign-in provider account secure.
        </li>
        <li>
          You must meet the minimum age required by your sign-in provider and by
          the law where you live.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        &quot;Content&quot; means the collections, decks, and other information
        you add to the app. You keep ownership of your Content.
      </p>
      <p>
        To operate the app, you grant us a non-exclusive, worldwide, royalty-free
        license to store, copy, and display your Content. This includes showing
        collections and decks you choose to share or publish to the people you
        share them with or to the public, depending on the visibility you set.
        This license ends when you delete the Content, except for copies kept in
        backups for a limited time and copies other people already made of
        content you shared with them.
      </p>
      <p>
        You control visibility. Collections are private unless you set them to
        be shared by link or public. Decks you publish are visible to other
        users. Only post Content you have the right to share.
      </p>

      <h2>5. Acceptable use</h2>
      <p>When using the app, you agree not to:</p>
      <ul>
        <li>break any law or infringe anyone&apos;s rights;</li>
        <li>harass, threaten, or abuse other users;</li>
        <li>impersonate another person or misrepresent your affiliation with anyone, including Riot Games;</li>
        <li>try to access another user&apos;s account or non-public data;</li>
        <li>upload malware or anything designed to disrupt the app;</li>
        <li>scrape, or send automated traffic at a rate that degrades the app for others;</li>
        <li>attempt to bypass security or access controls.</li>
      </ul>
      <p>
        We may remove Content and restrict accounts that violate these rules.
      </p>

      <h2>6. Riot Games and card data</h2>
      <p>
        Riftbound Deckbuilder isn&apos;t endorsed by Riot Games and doesn&apos;t
        reflect the views or opinions of Riot Games or anyone officially involved
        in producing or managing Riot Games properties. Riot Games, and all
        associated properties are trademarks or registered trademarks of Riot
        Games, Inc.
      </p>

      <h2>7. What the app does not do</h2>
      <p>
        The app does not collect or display play, match, or win-rate statistics
        for you or for any other player.
      </p>

      <h2>8. No warranty</h2>
      <p>
        The app is free and is provided &quot;as is&quot; and &quot;as
        available&quot;, without warranties of any kind, whether express or
        implied. This includes warranties of merchantability, fitness for a
        particular purpose, and non-infringement. We don&apos;t guarantee that
        card data is complete or accurate, or that the app will always be
        available, secure, or error-free.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any
        indirect, incidental, special, consequential, or punitive damages, or
        for any loss of data, profits, or goodwill, arising from your use of the
        app. Our total liability for any claim relating to the app is limited to
        the greater of US$50 or the amount you paid us for the app in the twelve
        months before the claim (which is currently nothing, because the app is
        free). Some jurisdictions do not allow certain limitations, so some of
        these limits may not apply to you.
      </p>

      <h2>10. Termination</h2>
      <p>
        You can stop using the app at any time and ask us to delete your account
        as described in the Privacy Policy. We may suspend or terminate accounts
        that violate these terms, and we may change or discontinue the app. The
        sections that by their nature should survive termination, such as the
        license to content in backups and the limitation of liability, will
        survive.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. When we do, we will change
        the &quot;Last updated&quot; date and, for material changes, make a
        reasonable effort to let users know, such as through the app. Continuing
        to use the app after an update means you accept the updated terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        {/* TODO: replace contact@example.com with the real contact address before launch. */}
        <a href="mailto:contact@example.com">contact@example.com</a>.
      </p>
    </>
  );
}
