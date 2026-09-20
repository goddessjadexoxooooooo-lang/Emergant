import { useEffect, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import api from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;

// mode: "order" (one-time) | "subscription" (recurring)
export default function PayPalCheckout({ mode, amount, frequency, guest, onSuccess }) {
  const [planId, setPlanId] = useState(null);
  const [planError, setPlanError] = useState(false);

  useEffect(() => {
    let active = true;
    if (mode === "subscription") {
      setPlanId(null);
      setPlanError(false);
      api
        .post("/paypal/create-plan", { amount, frequency })
        .then((r) => active && setPlanId(r.data.plan_id))
        .catch(() => active && setPlanError(true));
    }
    return () => { active = false; };
  }, [mode, amount, frequency]);

  const options =
    mode === "subscription"
      ? { clientId: CLIENT_ID, vault: true, intent: "subscription" }
      : { clientId: CLIENT_ID, currency: "USD", intent: "capture" };

  if (mode === "subscription" && planError) {
    return <p className="text-center text-sm text-destructive" data-testid="paypal-plan-error">Could not initialise the recurring plan. Please try again.</p>;
  }

  if (mode === "subscription" && !planId) {
    return (
      <div className="flex justify-center py-6" data-testid="paypal-loading">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="paypal-checkout" className="min-h-[52px]">
      <PayPalScriptProvider options={options} key={`${mode}-${amount}-${frequency}-${planId}`}>
        <PayPalButtons
          style={{ shape: "pill", color: "gold", layout: "vertical", label: mode === "subscription" ? "subscribe" : "pay" }}
          forceReRender={[mode, amount, frequency, planId]}
          {...(mode === "subscription"
            ? {
                createSubscription: (data, actions) => actions.subscription.create({ plan_id: planId }),
                onApprove: async (data) => {
                  await api.post("/paypal/record-subscription", {
                    subscription_id: data.subscriptionID,
                    amount,
                    frequency,
                  });
                  onSuccess({ type: "recurring", amount, frequency });
                },
              }
            : {
                createOrder: async () => {
                  const { data } = await api.post("/paypal/create-order", { amount });
                  return data.id;
                },
                onApprove: async (data) => {
                  const { data: res } = await api.post("/paypal/capture-order", {
                    order_id: data.orderID,
                    amount,
                    guest_name: guest?.name,
                    guest_email: guest?.email,
                  });
                  if (res.status === "COMPLETED") onSuccess({ type: "one-time", amount });
                  else toast.error("Payment not completed.");
                },
              })}
          onError={() => toast.error("PayPal encountered an error. Please try again.")}
          onCancel={() => toast.message("Tribute cancelled.")}
        />
      </PayPalScriptProvider>
    </div>
  );
}
