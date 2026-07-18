/** Renders a JSON-LD script tag. Data must describe only visible public
 * content — never fabricate ratings, reviews, or availability. */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
