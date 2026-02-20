/**
 * Utility functions for Stripe webhook handlers
 */

import stripe from '@/lib/stripe';

/**
 * Met à jour les billing details du Customer Stripe depuis une session Checkout
 * Cette fonction DOIT être appelée AVANT que Stripe ne crée automatiquement l'Invoice pour un nouvel abonnement
 * @param {string} customerId - ID du customer Stripe
 * @param {object} session - Session Checkout Stripe complète
 */
export async function updateCustomerBillingDetailsFromCheckout(customerId, session) {
  try {
    // Récupérer les billing details de base depuis la session Checkout
    const customerDetails = session.customer_details;

    if (!customerDetails) {
      console.warn(`[Webhook] ⚠️ Pas de customer_details dans la session ${session.id}`);
      return;
    }

    // Initialiser avec les billing details de la session
    let finalBillingDetails = {
      name: customerDetails.name,
      email: customerDetails.email,
      address: customerDetails.address,
    };

    console.log(`[Webhook] → Billing details Checkout Session (base):`, {
      name: customerDetails.name || 'N/A',
      email: customerDetails.email || 'N/A',
      address: customerDetails.address ? `${customerDetails.address.city}, ${customerDetails.address.country}` : 'N/A',
    });

    // Essayer de récupérer des billing details plus récents depuis le PaymentIntent
    // Important pour les Customers existants qui changent leur adresse dans le formulaire
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ['charges'],
        });

        // Si le PaymentIntent a des charges avec billing details, les utiliser en priorité
        if (paymentIntent.charges?.data?.[0]?.billing_details) {
          const piBillingDetails = paymentIntent.charges.data[0].billing_details;

          // Fusionner (priorité au PaymentIntent car plus récent)
          finalBillingDetails = {
            name: piBillingDetails.name || finalBillingDetails.name,
            email: piBillingDetails.email || finalBillingDetails.email,
            address: piBillingDetails.address || finalBillingDetails.address,
          };

          console.log(`[Webhook] → Billing details PaymentIntent (prioritaire):`, {
            name: piBillingDetails.name || 'N/A',
            email: piBillingDetails.email || 'N/A',
            address: piBillingDetails.address ? `${piBillingDetails.address.line1 || ''}, ${piBillingDetails.address.city}` : 'N/A',
          });
        } else {
          console.log(`[Webhook] → PaymentIntent sans charges, utilisation des billing details de la session`);
        }
      } catch (error) {
        console.warn(`[Webhook] ⚠️ Impossible de récupérer PaymentIntent ${session.payment_intent}:`, error.message);
      }
    }

    // IMPORTANT : Vérifier qu'on a au moins une adresse (obligation légale)
    if (!finalBillingDetails.address) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucune adresse de facturation disponible pour la session ${session.id} - FACTURE SANS ADRESSE IMPOSSIBLE`);
    }

    // Mettre à jour le Customer Stripe avec les billing details finaux
    if (finalBillingDetails.name || finalBillingDetails.email || finalBillingDetails.address) {
      await stripe.customers.update(customerId, {
        name: finalBillingDetails.name || undefined,
        email: finalBillingDetails.email || undefined,
        address: finalBillingDetails.address || undefined,
      });
      console.log(`[Webhook] ✓ Customer ${customerId} mis à jour avec billing details (nom: ${finalBillingDetails.name || 'N/A'}, adresse: ${finalBillingDetails.address ? 'présente' : 'absente'})`);
    } else {
      console.warn(`[Webhook] ⚠️ Aucun billing details à mettre à jour pour le Customer ${customerId}`);
    }
  } catch (error) {
    console.error(`[Webhook] Erreur lors de la mise à jour des billing details du Customer:`, error);
  }
}
