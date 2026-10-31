import { Check, X, Minus } from "lucide-react";
import { COMPARE_TM, COMPARE_NOTE, COMPARE_SOURCE } from "./lpData";

/* Meeticulous vs Topmate — side-by-side table for the Topmate LP.
   Data + honesty stance live in lpData.js (COMPARE_TM). Wide table scrolls
   inside its own container so the page body never scrolls sideways on mobile. */
export default function LpCompareTable() {
  return (
    <section id="compare" className="bg-canvas px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-[2.8rem]">
          Meeticulous <span className="text-neutral-400">vs</span>{" "}
          <span className="text-primary">Topmate</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-neutral-600">
          Both help you sell your time. Here&apos;s where they differ, with
          Topmate&apos;s edges included.
        </p>

        <div className="mt-10 overflow-x-auto rounded-[8px] border border-black/5 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Meeticulous compared with Topmate</caption>
            <thead>
              <tr className="border-b border-black/5">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Feature
                </th>
                <th className="px-5 py-4 font-heading text-sm font-extrabold text-primary">
                  Meeticulous 🇮🇳
                </th>
                <th className="px-5 py-4 text-sm font-semibold text-neutral-400">
                  Topmate
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_TM.map((row, i) => (
                <tr key={row.f} className={i % 2 ? "bg-primary/[0.02]" : "bg-white"}>
                  <th
                    scope="row"
                    className="px-5 py-3 text-sm font-medium text-ink"
                  >
                    {row.f}
                  </th>
                  {/* Meeticulous cell — highlighted; ✓ when BAS wins or parity, — when Topmate leads */}
                  <td className="bg-primary/[0.06] px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {row.win === false ? (
                        <Minus size={14} className="text-neutral-400" />
                      ) : (
                        <Check size={14} />
                      )}
                      {row.bas}
                    </span>
                  </td>
                  {/* Topmate cell — ✓ on parity or its own edge, ✗ where BAS wins,
                      — where Topmate's pricing page doesn't say ("unlisted") */}
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm ${
                        row.win === true || row.win === "unlisted" ? "text-neutral-400" : "text-neutral-600"
                      }`}
                    >
                      {row.win === "unlisted" ? (
                        <Minus size={14} className="text-neutral-300" />
                      ) : row.win === true ? (
                        <X size={14} className="text-neutral-300" />
                      ) : (
                        <Check size={14} className="text-neutral-400" />
                      )}
                      {row.tm}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-center text-xs text-neutral-400">
          {COMPARE_NOTE}{" "}
          <a href={COMPARE_SOURCE} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-ink">
            See Topmate&apos;s pricing
          </a>
          . Topmate is a trademark of its owner; Meeticulous isn&apos;t affiliated with Topmate.
          Spot something out of date? Tell us at hello@meeticulous.com.
        </p>
      </div>
    </section>
  );
}
