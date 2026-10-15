import type { CSSProperties } from "react";

export default function Headline({ text }: { text: string }) {
  return (
    <h1>
      {text.split(" ").map((word, i) => (
        <span key={i}>
          <span className="word">
            <span className="word-inner" style={{ "--i": i } as CSSProperties}>
              {word}
            </span>
          </span>{" "}
        </span>
      ))}
    </h1>
  );
}