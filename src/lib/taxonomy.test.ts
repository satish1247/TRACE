import { describe, expect, it } from "vitest";
import { classifyNarrative } from "./taxonomy";

describe("taxonomy: classifyNarrative", () => {
  it("names the digital-arrest scam from a spoken answer", () => {
    const c = classifyNarrative(
      "The police called and said my Aadhaar was used in a money laundering case. I have to send fifty thousand for verification to prove I am innocent.",
    );
    expect(c.scam).toBe("digital_arrest");
    expect(c.confidence).toBeGreaterThan(0.5);
    expect(c.rebuttal).toMatch(/digital-arrest/i);
    expect(c.stat).toMatch(/15,215/);
  });

  it("names the fake customer-care scam", () => {
    const c = classifyNarrative("My PhonePe payment failed so I googled the customer care number and they asked me to install AnyDesk for the refund.");
    expect(c.scam).toBe("fake_customer_care");
  });

  it("names the courier-parcel scam", () => {
    const c = classifyNarrative("Courier company says a parcel in my name has drugs and I must pay a penalty to release it.");
    expect(c.scam).toBe("courier_parcel");
  });

  it("returns unknown with a calm rebuttal for an unrecognised story", () => {
    const c = classifyNarrative("I am buying a sari from a shop.");
    expect(c.scam).toBe("unknown");
    expect(c.confidence).toBe(0);
    expect(c.rebuttal.length).toBeGreaterThan(20);
  });

  it("is deterministic", () => {
    const a = classifyNarrative("KYC expired, account will be blocked, click the link");
    const b = classifyNarrative("KYC expired, account will be blocked, click the link");
    expect(a).toEqual(b);
    expect(a.scam).toBe("kyc_update");
  });
});
