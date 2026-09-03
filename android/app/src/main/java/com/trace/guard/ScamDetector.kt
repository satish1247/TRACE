package com.trace.guard

/**
 * On-device scam detection. A direct port of the tested TypeScript engines
 * (src/lib/screening.ts and src/lib/taxonomy.ts) so the phone needs no server and no internet.
 *
 * The idea: most of these calls involve no voice cloning at all. A real human, a real phone.
 * So we read what the call is DOING, not how the audio was made.
 */
object ScamDetector {

    enum class Marker(val label: String, val weight: Int) {
        AUTHORITY("Authority claim", 15),
        THREAT("Manufactured threat", 20),
        ISOLATION("Isolation instruction", 30),
        DEMAND("Payment or credential demand", 20),
        BLOCKING("Verification blocking", 25)
    }

    private val patterns: Map<Marker, List<Regex>> = mapOf(
        Marker.AUTHORITY to listOf(
            Regex("""\b(delhi|mumbai|chennai|cyber)?\s*police\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(cbi|crime branch|cyber ?cell|trai|rbi|income tax|customs|narcotics|ncb|magistrate|court|inspector|officer|commissioner)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(bank (official|manager|officer)|customer care|courier|bluedart|fedex|dhl|electricity board|tneb|bescom)\b""", RegexOption.IGNORE_CASE),
            Regex("""\bnaan police\b""", RegexOption.IGNORE_CASE)
        ),
        Marker.THREAT to listOf(
            Regex("""\b(arrest(ed)?|warrant|jail|fir\b|case (has been )?(registered|filed)|legal action|money laundering|penalty)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(aadhaar|pan|sim|account) (number )?(was |has been |is )?(used|misused|linked|involved)""", RegexOption.IGNORE_CASE),
            Regex("""\b(disconnect(ed|ion)?|suspend(ed)?|block(ed)?)\b.*\b(account|power|electricity|sim|number|card)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(parcel|package|courier)\b.*\b(drugs|illegal|narcotics|held|seized)\b""", RegexOption.IGNORE_CASE),
            Regex("""\bgiraftaar\b|\bjail (bhej|jayega)""", RegexOption.IGNORE_CASE)
        ),
        Marker.ISOLATION to listOf(
            Regex("""\b(do ?n[o']?t|never|not) (tell|inform|discuss (this )?with|share (this )?with) (any ?one|anybody|your (family|son|daughter|husband|wife|neighbou?rs?|children)|nobody)""", RegexOption.IGNORE_CASE),
            Regex("""\bnot (tell|inform) any ?one\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(stay|remain|be) on (the |this )?(call|line|phone)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(do ?n[o']?t|never) (hang up|cut (the )?call|disconnect|end (the )?call)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(confidential|secret|classified) (investigation|matter|case)\b|\bkeep (this|it) (confidential|secret|between us)\b""", RegexOption.IGNORE_CASE),
            Regex("""\bkisi ko (mat |na )?bata(na|o|iye)\b|\byaarukkum solla(the|adheenga)\b""", RegexOption.IGNORE_CASE)
        ),
        Marker.DEMAND to listOf(
            Regex("""\b(transfer|send|pay|deposit|remit)\b.*\b(rupees|rs\.?|\d{2,}|thousand|lakh|amount|money)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(verification|security|refundable|processing|penalty|release|clearance) (account|fee|deposit|charge|amount)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(share|tell|read|give) (me |us )?(the |your )?(otp|pin|cvv|code|password)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(install|download|open)\b.*\b(anydesk|teamviewer|quick ?support|screen ?share|remote)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(paisa|paise|rupaye) (bhej|transfer|daal)""", RegexOption.IGNORE_CASE)
        ),
        Marker.BLOCKING to listOf(
            Regex("""\b(do ?n[o']?t|never|no need to) (call|contact|visit|go to|check with|verify with)\b.*\b(bank|branch|police station|police|anyone|family|1930)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(ignore|dismiss|skip) (the |any |that )?(warning|alert|message|popup|pop-up)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(it'?s|it is|that is|this is) (just |only )?(a )?(system|technical|app|software) (error|glitch|bug|issue)\b""", RegexOption.IGNORE_CASE),
            Regex("""\bno time to (verify|check|think)\b""", RegexOption.IGNORE_CASE),
            Regex("""\b(app|bank|phone) (will|may) (show|display) (a |some )?(warning|alert|message)\b""", RegexOption.IGNORE_CASE)
        )
    )

    data class Hit(val marker: Marker, val phrase: String)

    /** Markers found in one spoken line. */
    fun detect(text: String): List<Hit> {
        val hits = mutableListOf<Hit>()
        for ((marker, regexes) in patterns) {
            for (re in regexes) {
                val m = re.find(text)
                if (m != null) {
                    hits.add(Hit(marker, m.value.trim()))
                    break
                }
            }
        }
        return hits
    }

    /** 0..100. First hit of a marker carries its full weight; repeats add a little. */
    fun risk(all: List<Hit>): Int {
        val seen = mutableSetOf<Marker>()
        var score = 0
        for (h in all) {
            if (seen.contains(h.marker)) {
                score += 3
            } else {
                seen.add(h.marker)
                score += h.marker.weight
            }
        }
        return minOf(100, score)
    }

    // ---------------------------------------------------------------- scam taxonomy

    data class Scam(val id: String, val label: String, val rebuttal: String, val stat: String)

    private data class Def(val scam: Scam, val keywords: List<Pair<Regex, Int>>)

    private const val NATIONAL =
        "India's cyber-fraud losses were projected at Rs 1.2 lakh crore for 2025 (I4C)."

    private val defs = listOf(
        Def(
            Scam(
                "digital_arrest", "Digital arrest scam",
                "No police force, court or CBI office in India ever collects money by UPI, and nobody is 'digitally arrested' over a phone call. Your money is safe.",
                "15,215 people reported this same call in the first five months of 2026."
            ),
            listOf(
                Regex("""\b(police|cbi|cyber ?cell|crime branch|inspector|officer|narcotics|ncb|customs)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(arrest|warrant|case|jail|fir|money laundering|laundering)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(aadhaar|pan|sim)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(verification|verify|prove|innocent|innocence)\b""", RegexOption.IGNORE_CASE) to 2,
                Regex("""\b(court|magistrate|judge)\b""", RegexOption.IGNORE_CASE) to 2
            )
        ),
        Def(
            Scam(
                "kyc_update", "KYC update / account block scam",
                "Banks never block an account within hours over a phone call, and KYC is never completed by paying or sharing a PIN.",
                NATIONAL
            ),
            listOf(
                Regex("""\bkyc\b""", RegexOption.IGNORE_CASE) to 4,
                Regex("""\b(update|expire|expired|expiry|re-?verify|pending)\b""", RegexOption.IGNORE_CASE) to 2,
                Regex("""\b(account|sim|card)\b.*\b(block|blocked|suspend|suspended)""", RegexOption.IGNORE_CASE) to 3
            )
        ),
        Def(
            Scam(
                "fake_customer_care", "Fake customer-care scam",
                "A helpline found through search results is not a helpline; scammers buy the top spots. Real support never asks you to install screen-sharing apps.",
                NATIONAL
            ),
            listOf(
                Regex("""\b(customer care|helpline|support number|toll ?free)\b""", RegexOption.IGNORE_CASE) to 4,
                Regex("""\b(google|searched|search|found the number)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(refund|failed|stuck|pending|not received)\b""", RegexOption.IGNORE_CASE) to 2,
                Regex("""\b(anydesk|teamviewer|screen ?share|remote|install)\b""", RegexOption.IGNORE_CASE) to 3
            )
        ),
        Def(
            Scam(
                "courier_parcel", "Courier / parcel-held scam",
                "Customs and courier companies do not phone you about drugs in a parcel, and they never take penalties by UPI.",
                NATIONAL
            ),
            listOf(
                Regex("""\b(courier|parcel|package|shipment|bluedart|fedex|dhl|dtdc|customs)\b""", RegexOption.IGNORE_CASE) to 4,
                Regex("""\b(drugs|illegal|narcotics|seized|held|contraband)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(penalty|fine|release|clearance|fee)\b""", RegexOption.IGNORE_CASE) to 2
            )
        ),
        Def(
            Scam(
                "electricity", "Electricity disconnection scam",
                "Electricity boards send printed notices and never disconnect at night over a phone call, and never collect through a personal UPI ID.",
                NATIONAL
            ),
            listOf(
                Regex("""\b(electricity|power|current|eb|tneb|bescom|bill)\b""", RegexOption.IGNORE_CASE) to 4,
                Regex("""\b(disconnect|disconnected|cut|tonight|today)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(pending|unpaid|overdue)\b""", RegexOption.IGNORE_CASE) to 2
            )
        ),
        Def(
            Scam(
                "family_emergency", "Relative-in-trouble scam",
                "Call the family member directly on their own number before sending anything. A real emergency survives a two-minute phone call; a scam does not.",
                NATIONAL
            ),
            listOf(
                Regex("""\b(son|daughter|grandson|granddaughter|nephew|relative)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(accident|hospital|arrested|police station|emergency|stuck)\b""", RegexOption.IGNORE_CASE) to 3,
                Regex("""\b(bail|treatment|surgery|fees)\b""", RegexOption.IGNORE_CASE) to 2
            )
        )
    )

    private val unknown = Scam(
        "unknown", "Unrecognised story, strong pressure signs",
        "We could not match this to a known scam, but the signs of pressure are strong. Nobody genuine needs money from you in the next ten minutes.",
        NATIONAL
    )

    /** Best-matching scam for the whole conversation so far. */
    fun classify(transcript: String): Scam {
        if (transcript.isBlank()) return unknown
        var best: Def? = null
        var bestScore = 0
        for (d in defs) {
            var s = 0
            for ((re, w) in d.keywords) if (re.containsMatchIn(transcript)) s += w
            if (s > bestScore) {
                bestScore = s
                best = d
            }
        }
        val chosen = best
        return if (bestScore >= 6 && chosen != null) chosen.scam else unknown
    }

    /** Above this the overlay warning appears. Isolation plus one other marker reaches it. */
    const val WARN_THRESHOLD = 45
}
