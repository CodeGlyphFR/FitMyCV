/**
 * Utility functions for Stripe webhook handlers
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';

/**
 * Crée une facture Stripe pour un achat de crédits
 * IMPORTANT: Cette fonction doit être appelée depuis payment_intent.succeeded (PAS checkout.session.completed)
 * car les charges avec billing_details ne sont disponibles qu'après payment_intent.succeeded
 *
 * @param {object} params - {customer, amount, currency, creditAmount, userId, paymentIntent}
 * @param {string} transactionId - ID de la CreditTransaction à mettre à jour
 * @returns {Promise<string|null>} - ID de la facture créée ou null en cas d'erreur
 */
export async function createInvoiceForCreditPurchase({ customer, amount, currency, creditAmount, userId, paymentIntent, stripePriceId }, transactionId) {
  try {
    // Récupérer les billing details depuis le PaymentIntent (TOUJOURS disponibles dans payment_intent.succeeded)
    const billingDetails = paymentIntent.charges?.data?.[0]?.billing_details;

    if (!billingDetails) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucun billing_details trouvé dans PaymentIntent ${paymentIntent.id} - impossible de créer facture`);
      return null;
    }

    console.log(`[Webhook] → Billing details PaymentIntent (garantis disponibles):`, {
      name: billingDetails.name || 'N/A',
      email: billingDetails.email || 'N/A',
      address: billingDetails.address ? `${billingDetails.address.line1 || ''}, ${billingDetails.address.city}, ${billingDetails.address.country}` : 'N/A',
    });

    // IMPORTANT : Vérifier qu'on a au moins une adresse (obligation légale)
    if (!billingDetails.address) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucune adresse de facturation disponible pour le PaymentIntent ${paymentIntent.id} - FACTURE SANS ADRESSE IMPOSSIBLE`);
      return null;
    }

    // Mettre à jour le Customer Stripe avec les billing details du PaymentIntent
    // L'Invoice utilisera automatiquement ces informations
    await stripe.customers.update(customer, {
      name: billingDetails.name || undefined,
      email: billingDetails.email || undefined,
      address: billingDetails.address || undefined,
    });
    console.log(`[Webhook] ✓ Customer ${customer} mis à jour avec billing details (nom: ${billingDetails.name || 'N/A'}, adresse: présente)`);

    // Récupérer les tax IDs du compte Stripe (numéro de TVA, etc.)
    let accountTaxIds = [];
    try {
      const taxIds = await stripe.taxIds.list({ limit: 10 });
      accountTaxIds = taxIds.data.map(t => t.id);
    } catch (taxIdError) {
      console.warn('[Webhook] Impossible de récupérer les tax IDs du compte:', taxIdError.message);
    }

    // Créer un draft invoice
    // L'Invoice hérite automatiquement des billing details du Customer mis à jour ci-dessus
    const invoiceParams = {
      customer: customer,
      auto_advance: false, // Ne pas envoyer automatiquement
      collection_method: 'charge_automatically',
      automatic_tax: { enabled: true },
      description: `Achat de ${creditAmount} crédits FitMyCV.io`,
      metadata: {
        userId: userId,
        creditAmount: creditAmount.toString(),
        paymentIntentId: paymentIntent.id,
        source: 'credit_pack_purchase',
      },
    };

    // Ajouter les tax IDs du compte (numéro de TVA intracommunautaire, etc.)
    if (accountTaxIds.length > 0) {
      invoiceParams.account_tax_ids = accountTaxIds;
    }

    // Ajouter le SIREN en champ personnalisé (mention légale obligatoire en France)
    if (process.env.STRIPE_BUSINESS_SIREN) {
      invoiceParams.custom_fields = [
        { name: 'SIREN', value: process.env.STRIPE_BUSINESS_SIREN },
      ];
    }

    // Appliquer le modèle de rendu de facture si configuré
    if (process.env.STRIPE_INVOICE_TEMPLATE_ID) {
      invoiceParams.rendering = {
        template: process.env.STRIPE_INVOICE_TEMPLATE_ID,
      };
    }

    let invoice;
    try {
      invoice = await stripe.invoices.create(invoiceParams);
    } catch (templateError) {
      if (process.env.STRIPE_INVOICE_TEMPLATE_ID) {
        console.warn(`[Webhook] Template facture invalide (${process.env.STRIPE_INVOICE_TEMPLATE_ID}), création facture sans template:`, templateError.message);
        delete invoiceParams.rendering;
        invoice = await stripe.invoices.create(invoiceParams);
      } else {
        throw templateError;
      }
    }

    // Ajouter l'item à la facture (utiliser le price Stripe pour hériter du tax_behavior)
    if (stripePriceId) {
      await stripe.invoiceItems.create({
        customer: customer,
        invoice: invoice.id,
        price: stripePriceId,
        quantity: 1,
      });
    } else {
      // Fallback: montant brut si pas de price ID (anciens achats)
      await stripe.invoiceItems.create({
        customer: customer,
        invoice: invoice.id,
        amount: amount,
        currency: currency,
        description: `Pack de ${creditAmount} crédits`,
      });
    }

    // Finaliser la facture (génère le PDF immédiatement)
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    console.log(`[Webhook] ✓ Facture Stripe créée: ${finalizedInvoice.id} pour PaymentIntent ${paymentIntent.id}`);
    console.log(`[Webhook]   → PDF URL: ${finalizedInvoice.invoice_pdf || 'NULL - PDF non généré'}`);

    // Marquer la facture comme payée (le paiement a déjà été effectué via checkout)
    const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
      paid_out_of_band: true,
    });

    console.log(`[Webhook] ✓ Facture ${paidInvoice.id} marquée comme payée (status: ${paidInvoice.status})`);

    // Mettre à jour la transaction avec l'ID de la facture
    await prisma.creditTransaction.update({
      where: { id: transactionId },
      data: { stripeInvoiceId: paidInvoice.id },
    });

    return paidInvoice.id;
  } catch (invoiceError) {
    console.error('[Webhook] Erreur lors de la création de la facture:', invoiceError);
    return null;
  }
}

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
        // Continuer avec session.customer_details
      }
    }

    console.log(`[Webhook] → Billing details finaux utilisés:`, {
      name: finalBillingDetails.name || 'N/A',
      email: finalBillingDetails.email || 'N/A',
      address: finalBillingDetails.address ? `${finalBillingDetails.address.line1 || ''}, ${finalBillingDetails.address.city}, ${finalBillingDetails.address.country}` : 'N/A',
    });

    // IMPORTANT : Vérifier qu'on a au moins une adresse (obligation légale)
    if (!finalBillingDetails.address) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucune adresse de facturation disponible pour la session ${session.id} - FACTURE SANS ADRESSE IMPOSSIBLE`);
    }

    // Mettre à jour le Customer Stripe avec les billing details finaux
    // Cela permettra à Stripe d'utiliser automatiquement ces infos lors de la création de l'Invoice
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
