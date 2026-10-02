/**
 * ✅ PAYMENT GATEWAY ABSTRACTION
 *
 * The platform currently uses a simulated gateway. To go live with e-commerce:
 *  - implement `charge()` for a real provider (Stripe, Konnect, Paymob…)
 *  - set PAYMENT_PROVIDER in .env
 *  - implement the webhook handler for asynchronous confirmation
 *
 * The rest of the application only talks to this interface.
 */

class PaymentError extends Error {
  constructor(message, code = "payment_error") {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

/**
 * Simulated provider — instant success, no external calls.
 * Keeps the existing developer/test flow working.
 */
const simulatedProvider = {
  name: "simulated",

  /**
   * @param {{ amount:number, currency:string, description:string, metadata:object }} params
   * @returns {Promise<{ provider:string, reference:string, status:"paid" }>}
   */
  async charge({ amount, description, metadata }) {
    if (!amount || amount <= 0) {
      throw new PaymentError("Invalid amount", "invalid_amount");
    }
    return {
      provider: this.name,
      reference: `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      status: "paid",
      description,
      metadata
    };
  },

  async refund() {
    throw new PaymentError("Refunds not supported by the simulated provider", "not_supported");
  }
};

// Registry — add real providers here (e.g. stripeProvider, konnectProvider)
const providers = {
  simulated: simulatedProvider
};

function getPaymentProvider() {
  const name = process.env.PAYMENT_PROVIDER || "simulated";
  const provider = providers[name];
  if (!provider) {
    throw new PaymentError(`Unknown payment provider: ${name}`, "unknown_provider");
  }
  return provider;
}

module.exports = { getPaymentProvider, PaymentError };
