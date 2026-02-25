'use client';

import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconDroplet,
  IconFileInvoice,
  IconGlassFull,
  IconPackage,
  IconQrcode,
  IconShieldCheck,
  IconSnowflake,
  IconTemperature,
  IconTruck,
  IconUser,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

type TabId = 'overview' | 'partner' | 'distributor' | 'admin' | 'client' | 'cold-chain';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof IconUsers;
  color: string;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: IconUsers, color: 'bg-violet-500' },
  { id: 'partner', label: 'Wine Partner', icon: IconGlassFull, color: 'bg-emerald-500' },
  { id: 'distributor', label: 'Distributor', icon: IconBuilding, color: 'bg-blue-500' },
  { id: 'admin', label: 'C&C Admin', icon: IconUserCheck, color: 'bg-amber-500' },
  { id: 'client', label: 'Client', icon: IconUser, color: 'bg-pink-500' },
  { id: 'cold-chain', label: 'Cold Chain', icon: IconSnowflake, color: 'bg-cyan-500' },
];

interface FlowStepProps {
  number: number;
  title: string;
  description: string;
  status?: string;
  actor: 'partner' | 'distributor' | 'admin' | 'client' | 'system';
  isLast?: boolean;
  notification?: string;
}

const actorColors = {
  partner: 'border-emerald-500 bg-emerald-500/10',
  distributor: 'border-blue-500 bg-blue-500/10',
  admin: 'border-amber-500 bg-amber-500/10',
  client: 'border-pink-500 bg-pink-500/10',
  system: 'border-violet-500 bg-violet-500/10',
};

const actorBadgeColors = {
  partner: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  distributor: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  admin: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  client: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
  system: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
};

const actorLabels = {
  partner: 'Wine Partner',
  distributor: 'Distributor',
  admin: 'C&C Admin',
  client: 'Client',
  system: 'System',
};

const NotificationBadge = ({ text }: { text: string }) => (
  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
    <span>📧</span>
    <span>{text}</span>
  </div>
);

const FlowStep = ({ number, title, description, status, actor, isLast = false, notification }: FlowStepProps) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${actorColors[actor]}`}
      >
        <span className="text-sm font-semibold">{number}</span>
      </div>
      {!isLast && <div className="mt-2 h-full w-0.5 bg-border-primary" />}
    </div>
    <div className={`pb-6 ${isLast ? '' : ''}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Typography variant="bodySm" className="font-semibold">
          {title}
        </Typography>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actorBadgeColors[actor]}`}>
          {actorLabels[actor]}
        </span>
      </div>
      <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
        {description}
      </Typography>
      {status && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-fill-secondary px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-text-secondary">{status}</span>
        </div>
      )}
      {notification && <NotificationBadge text={notification} />}
    </div>
  </div>
);

const StatusBadge = ({ status, color }: { status: string; color: string }) => (
  <div className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ${color}`}>
    <span className="text-xs font-medium">{status}</span>
  </div>
);

const OverviewTab = () => (
  <div className="space-y-8">
    {/* Holistic Overview Diagram */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        PCO End-to-End Process Overview
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-6">
        Private Client Orders (PCO) enable wine partners to fulfill orders for their private clients
        through licensed UAE distributors.
      </Typography>

      {/* Visual Flow */}
      <div className="relative overflow-x-auto pb-4">
        <div className="flex min-w-max items-center gap-2">
          {/* Phase 1 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3">
              <Icon icon={IconGlassFull} size="lg" className="text-emerald-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-emerald-500">Partner</span>
            <span className="text-xs text-text-muted">Creates Order</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 2 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-amber-500 bg-amber-500/10 p-3">
              <Icon icon={IconUserCheck} size="lg" className="text-amber-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-amber-500">C&C Admin</span>
            <span className="text-xs text-text-muted">Reviews & Approves</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 3 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-blue-500 bg-blue-500/10 p-3">
              <Icon icon={IconBuilding} size="lg" className="text-blue-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-blue-500">Distributor</span>
            <span className="text-xs text-text-muted">Assigned</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 4 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-pink-500 bg-pink-500/10 p-3">
              <Icon icon={IconCreditCard} size="lg" className="text-pink-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-pink-500">Client</span>
            <span className="text-xs text-text-muted">Pays Distributor</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 5 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-blue-500 bg-blue-500/10 p-3">
              <Icon icon={IconPackage} size="lg" className="text-blue-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-blue-500">Distributor</span>
            <span className="text-xs text-text-muted">Receives Stock</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 6 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-blue-500 bg-blue-500/10 p-3">
              <Icon icon={IconTruck} size="lg" className="text-blue-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-blue-500">Distributor</span>
            <span className="text-xs text-text-muted">Delivers to Client</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          {/* Phase 7 */}
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3">
              <Icon icon={IconCheck} size="lg" className="text-emerald-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-emerald-500">Complete</span>
            <span className="text-xs text-text-muted">Order Delivered</span>
          </div>
        </div>
      </div>
    </div>

    {/* Status Flow */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Order Status Flow
      </Typography>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status="DRAFT" color="bg-gray-500/20 text-gray-600 dark:text-gray-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="SUBMITTED" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="UNDER_CC_REVIEW" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="CC_APPROVED" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Optional Verification Flow */}
      <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
        <Typography variant="bodyXs" className="mb-2 font-semibold text-blue-600 dark:text-blue-400">
          Optional: Client Verification Flow (for certain distributors)
        </Typography>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="AWAITING_PARTNER_VERIFICATION" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
          <StatusBadge status="AWAITING_DISTRIBUTOR_VERIFICATION" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* Payment Flow */}
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status="AWAITING_CLIENT_PAYMENT" color="bg-pink-500/20 text-pink-600 dark:text-pink-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="AWAITING_PAYMENT_VERIFICATION" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="CLIENT_PAID" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Delivery Flow */}
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status="SCHEDULING_DELIVERY" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="DELIVERY_SCHEDULED" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="OUT_FOR_DELIVERY" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="DELIVERED" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
      </div>
    </div>

    {/* Stock Status Tracking */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Stock Status Tracking (Per Item)
      </Typography>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status="PENDING" color="bg-gray-500/20 text-gray-600 dark:text-gray-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="CONFIRMED" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="IN_TRANSIT_TO_CC" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="AT_CC_BONDED" color="bg-violet-500/20 text-violet-600 dark:text-violet-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="IN_TRANSIT_TO_DISTRIBUTOR" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="AT_DISTRIBUTOR" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="DELIVERED" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
      </div>
    </div>

    {/* Three-Way Payment Settlement */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Three-Way Payment Settlement
      </Typography>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconUser} size="sm" className="text-pink-500" />
            <Typography variant="bodySm" className="font-semibold">
              1. Client → Distributor
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            Client pays the full order value (including duty, VAT, and fees) directly to the
            distributor.
          </Typography>
        </div>

        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconBuilding} size="sm" className="text-violet-500" />
            <Typography variant="bodySm" className="font-semibold">
              2. Distributor → C&C
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            Distributor settles with C&C for product cost and logistics after delivery.
          </Typography>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconGlassFull} size="sm" className="text-emerald-500" />
            <Typography variant="bodySm" className="font-semibold">
              3. C&C → Wine Partner
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            C&C pays the wine partner their share once the order is delivered and settled.
          </Typography>
        </div>
      </div>
    </div>

    {/* Actors Legend */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Key Actors
      </Typography>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-2">
            <Icon icon={IconGlassFull} size="sm" className="text-emerald-500" />
          </div>
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Wine Partner
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Creates orders for their private clients
            </Typography>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="rounded-lg border-2 border-amber-500 bg-amber-500/10 p-2">
            <Icon icon={IconUserCheck} size="sm" className="text-amber-500" />
          </div>
          <div>
            <Typography variant="bodySm" className="font-semibold">
              C&C Admin
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Reviews, approves, and assigns orders
            </Typography>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="rounded-lg border-2 border-blue-500 bg-blue-500/10 p-2">
            <Icon icon={IconBuilding} size="sm" className="text-blue-500" />
          </div>
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Distributor
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Licensed partner for payment & delivery
            </Typography>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="rounded-lg border-2 border-pink-500 bg-pink-500/10 p-2">
            <Icon icon={IconUser} size="sm" className="text-pink-500" />
          </div>
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Client
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              End customer receiving the wine
            </Typography>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PartnerTab = () => (
  <div className="space-y-6">
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <Typography variant="bodySm" className="font-semibold text-emerald-600 dark:text-emerald-400">
        Wine Partner Journey
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        As a wine partner, you create orders for your private clients and track them through to
        delivery.
      </Typography>
    </div>

    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-6">
        Your Process Flow
      </Typography>

      <FlowStep
        number={1}
        title="Create New Order"
        description="Start a new PCO by entering your client's details: name, email, phone, and delivery address. Add any special delivery notes."
        status="DRAFT"
        actor="partner"
      />

      <FlowStep
        number={2}
        title="Add Products"
        description="Search and add products to the order. Set quantities and review the pricing breakdown for each line item."
        status="DRAFT"
        actor="partner"
      />

      <FlowStep
        number={3}
        title="Submit for Review"
        description="Once complete, submit the order to C&C for review. You'll receive an order number (e.g., PCO-2026-00001)."
        status="SUBMITTED"
        actor="partner"
        notification="C&C Admin notified"
      />

      <FlowStep
        number={4}
        title="Wait for Approval"
        description="C&C reviews your order, confirms stock availability, and approves with pricing. You'll be notified when approved."
        status="CC_APPROVED"
        actor="admin"
        notification="Partner notified of approval"
      />

      <FlowStep
        number={5}
        title="Verify Client (If Required)"
        description="Some distributors require client verification. If asked, confirm whether your client is known to the distributor."
        status="AWAITING_PARTNER_VERIFICATION"
        actor="partner"
      />

      <FlowStep
        number={6}
        title="Confirm Client Payment"
        description="Once your client has paid the distributor, confirm the payment on the platform. The distributor will then verify receipt."
        status="AWAITING_PAYMENT_VERIFICATION"
        actor="partner"
      />

      <FlowStep
        number={7}
        title="Acknowledge Invoice"
        description="Review and acknowledge the distributor's invoice when uploaded."
        actor="partner"
      />

      <FlowStep
        number={8}
        title="Track Delivery"
        description="Monitor the order status as it moves through scheduling, dispatch, and delivery. You'll be notified at each stage."
        status="DELIVERED"
        actor="distributor"
        isLast
      />
    </div>

    {/* Partner Notifications */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Notifications You Will Receive
      </Typography>

      <div className="space-y-3">
        {[
          { event: 'Order Approved', description: 'When C&C approves your order' },
          { event: 'Revision Requested', description: 'If C&C requests changes to the order' },
          { event: 'Verification Required', description: 'When client verification is needed' },
          { event: 'Client Verified', description: 'When distributor confirms client' },
          { event: 'Payment Verified', description: 'When distributor confirms payment received' },
          { event: 'Stock Received', description: 'When stock arrives at distributor' },
          { event: 'Delivery Scheduled', description: 'When delivery date is confirmed' },
          { event: 'Order Delivered', description: 'When order is successfully delivered' },
          { event: 'Partner Payment', description: 'When C&C has paid your share' },
        ].map((item) => (
          <div key={item.event} className="flex items-center gap-3 rounded-lg bg-fill-secondary/50 p-3">
            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {item.event}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {item.description}
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DistributorTab = () => (
  <div className="space-y-6">
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
      <Typography variant="bodySm" className="font-semibold text-blue-600 dark:text-blue-400">
        Distributor Journey
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        As a licensed distributor, you handle payment collection, stock receipt, and delivery to the
        end client.
      </Typography>
    </div>

    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-6">
        Your Process Flow
      </Typography>

      <FlowStep
        number={1}
        title="Receive Order Assignment"
        description="You receive notification when an order is assigned to you. A proforma invoice PDF with order details, products, and payment reference is attached."
        actor="system"
      />

      <FlowStep
        number={2}
        title="Verify Client (If Required)"
        description="Check if the client is registered in your system. Confirm verification status - this enables the payment flow to proceed."
        status="AWAITING_DISTRIBUTOR_VERIFICATION"
        actor="distributor"
      />

      <FlowStep
        number={3}
        title="Upload Invoice"
        description="Upload the official invoice for the order to the platform. This provides the client with payment details. The partner will acknowledge receipt."
        actor="distributor"
        notification="Partner notified of invoice"
      />

      <FlowStep
        number={4}
        title="Verify Payment Received"
        description="Once the client pays (using details from the invoice), verify the funds have been received in your account. Check the payment reference matches."
        status="CLIENT_PAID"
        actor="distributor"
        notification="Partner notified payment verified"
      />

      <FlowStep
        number={5}
        title="Confirm Stock Receipt"
        description="When stock items arrive at your warehouse, confirm receipt on the platform. This updates the stock status to 'At Distributor'."
        actor="distributor"
      />

      <FlowStep
        number={6}
        title="Contact Client & Schedule Delivery"
        description="Reach out to the client to arrange a delivery date and time. Log contact attempts and confirm the scheduled date."
        status="DELIVERY_SCHEDULED"
        actor="distributor"
      />

      <FlowStep
        number={7}
        title="Dispatch Order"
        description="When ready, mark the order as dispatched. The system verifies all stock items are ready before allowing dispatch."
        status="OUT_FOR_DELIVERY"
        actor="distributor"
      />

      <FlowStep
        number={8}
        title="Confirm Delivery"
        description="Mark the order as delivered. Capture proof of delivery (signature or photo) and any delivery notes."
        status="DELIVERED"
        actor="distributor"
        isLast
      />
    </div>

    {/* Stock Status Tracking */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Stock Status Tracking
      </Typography>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status="PENDING" color="bg-gray-500/20 text-gray-600 dark:text-gray-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="CONFIRMED" color="bg-blue-500/20 text-blue-600 dark:text-blue-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="IN_TRANSIT_TO_DISTRIBUTOR" color="bg-amber-500/20 text-amber-600 dark:text-amber-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="AT_DISTRIBUTOR" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
        <StatusBadge status="DELIVERED" color="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
      </div>
    </div>

    {/* Distributor Actions Summary */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Key Actions Summary
      </Typography>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: IconFileInvoice, title: 'Review Proforma', desc: 'Check order details and payment reference' },
          { icon: IconUserCheck, title: 'Verify Client', desc: 'Confirm client is in your system' },
          { icon: IconFileInvoice, title: 'Upload Invoice', desc: 'Provide client with payment details' },
          { icon: IconCreditCard, title: 'Verify Payment', desc: 'Confirm funds received' },
          { icon: IconPackage, title: 'Confirm Stock', desc: 'Mark items received at warehouse' },
          { icon: IconClock, title: 'Schedule Delivery', desc: 'Arrange date with client' },
          { icon: IconTruck, title: 'Dispatch', desc: 'Mark order in transit' },
          { icon: IconCheck, title: 'Confirm Delivery', desc: 'Capture proof of delivery' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
            <Icon icon={item.icon} size="sm" className="mt-0.5 text-blue-500" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {item.title}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {item.desc}
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AdminTab = () => (
  <div className="space-y-6">
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <Typography variant="bodySm" className="font-semibold text-amber-600 dark:text-amber-400">
        C&C Admin Journey
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        As an admin, you review orders, manage stock sources, assign distributors, and oversee the
        entire fulfillment process.
      </Typography>
    </div>

    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-6">
        Admin Process Flow
      </Typography>

      <FlowStep
        number={1}
        title="Receive Order Submission"
        description="Get notified when a wine partner submits a new order. Review appears in your admin dashboard."
        status="SUBMITTED"
        actor="system"
      />

      <FlowStep
        number={2}
        title="Review Order Details"
        description="Examine line items, client details, and partner notes. Verify product availability and pricing."
        status="UNDER_CC_REVIEW"
        actor="admin"
      />

      <FlowStep
        number={3}
        title="Approve or Request Revision"
        description="Approve the order with stock sources specified, or request revisions if changes are needed. Can apply bespoke pricing if required."
        status="CC_APPROVED"
        actor="admin"
      />

      <FlowStep
        number={4}
        title="Assign Distributor"
        description="Select and assign the appropriate licensed distributor for this order. The system determines if client verification is required."
        actor="admin"
      />

      <FlowStep
        number={5}
        title="Monitor Order Progress"
        description="Track the order through verification, payment, stock movement, and delivery stages via the admin dashboard."
        actor="admin"
      />

      <FlowStep
        number={6}
        title="Confirm Distributor Payment"
        description="When ready, confirm that C&C has paid the distributor for the order."
        actor="admin"
      />

      <FlowStep
        number={7}
        title="Confirm Partner Payment"
        description="Confirm that C&C has paid the wine partner their share of the order."
        actor="admin"
        isLast
      />
    </div>

    {/* Admin Capabilities */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Admin Capabilities
      </Typography>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: 'View All Orders', desc: 'Dashboard with filtering and status overview' },
          { title: 'Approve/Reject Orders', desc: 'Review and approve partner submissions' },
          { title: 'Request Revisions', desc: 'Ask partners to update order details' },
          { title: 'Set Stock Sources', desc: 'Specify where each item will be sourced' },
          { title: 'Apply Bespoke Pricing', desc: 'Override standard pricing margins' },
          { title: 'Assign Distributors', desc: 'Select distributor for fulfillment' },
          { title: 'Reset Verification', desc: 'Override verification status if needed' },
          { title: 'Confirm Payments', desc: 'Record distributor and partner payments' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {item.title}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {item.desc}
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ClientTab = () => (
  <div className="space-y-6">
    <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
      <Typography variant="bodySm" className="font-semibold text-pink-600 dark:text-pink-400">
        Client Journey
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        As the end client, you work with your wine partner to place orders and pay the distributor
        directly.
      </Typography>
    </div>

    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-6">
        Client Process Flow
      </Typography>

      <FlowStep
        number={1}
        title="Discuss Order with Wine Partner"
        description="Work with your wine partner to select products and quantities. They will create the order on your behalf."
        actor="client"
      />

      <FlowStep
        number={2}
        title="Order Created by Partner"
        description="Your wine partner creates and submits the order through the C&C platform with your details."
        actor="partner"
      />

      <FlowStep
        number={3}
        title="Receive Payment Details"
        description="Once approved, you'll receive payment details including the distributor's bank account and unique payment reference."
        actor="system"
      />

      <FlowStep
        number={4}
        title="Pay the Distributor"
        description="Transfer the full order value directly to the licensed distributor using the provided payment reference."
        actor="client"
      />

      <FlowStep
        number={5}
        title="Payment Verified"
        description="The distributor verifies your payment has been received. Your order moves to fulfillment."
        actor="distributor"
      />

      <FlowStep
        number={6}
        title="Delivery Scheduled"
        description="The distributor will contact you to arrange a convenient delivery date and time."
        actor="distributor"
      />

      <FlowStep
        number={7}
        title="Receive Delivery"
        description="Your wine is delivered to your specified address. Sign for receipt or provide delivery confirmation."
        actor="client"
        isLast
      />
    </div>

    {/* What Clients Need to Know */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Important Information
      </Typography>

      <div className="space-y-3">
        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            Payment Reference
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Always include the payment reference (e.g., CD-PCO-2026-00001) when making your bank
            transfer. This ensures quick payment verification.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            Licensed Distribution
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            All payments are made directly to licensed UAE distributors who are authorized to sell
            alcoholic beverages. C&C facilitates the ordering process.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            Delivery Coordination
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            The distributor will contact you directly to schedule delivery. Ensure your contact
            details are correct and you are available to receive the delivery.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            Pricing Includes
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            The total price includes: product cost, import duty, transfer costs, distributor fees,
            and VAT. All inclusive - no hidden charges.
          </Typography>
        </div>
      </div>
    </div>
  </div>
);

const ColdChainTab = () => (
  <div className="space-y-8">
    {/* Intro */}
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <Typography variant="bodySm" className="font-semibold text-cyan-600 dark:text-cyan-400">
        Cold Chain Verification
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        Every PCO case ships with a QR-coded label linking to live cold chain data. One scan tells
        your customer exactly how their wine was stored, handled, and delivered.
      </Typography>
    </div>

    {/* How It Works - 3 Steps */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-2">
        How It Works
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-6">
        Three steps to verified provenance
      </Typography>

      <div className="relative overflow-x-auto pb-4">
        <div className="flex min-w-max items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-cyan-500 bg-cyan-500/10 p-3">
              <Icon icon={IconQrcode} size="lg" className="text-cyan-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-cyan-500">Step 1</span>
            <span className="text-xs text-text-muted">Label Printed</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-cyan-500 bg-cyan-500/10 p-3">
              <Icon icon={IconUser} size="lg" className="text-cyan-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-cyan-500">Step 2</span>
            <span className="text-xs text-text-muted">Customer Scans</span>
          </div>
          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />

          <div className="flex flex-col items-center">
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3">
              <Icon icon={IconShieldCheck} size="lg" className="text-emerald-500" />
            </div>
            <span className="mt-2 text-xs font-medium text-emerald-500">Step 3</span>
            <span className="text-xs text-text-muted">Provenance Verified</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            1. Label is Printed
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            When an order is packed, thermal labels are generated with order details, product info,
            and a QR code unique to that case.
          </Typography>
        </div>
        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            2. Customer Scans QR
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            On receiving the case, the customer or distributor scans the QR code with any smartphone
            camera. No app required.
          </Typography>
        </div>
        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <Typography variant="bodySm" className="mb-1 font-medium">
            3. Provenance Verified
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            A branded page shows live cold room data, facility details, and the full provenance
            journey from winery to delivery.
          </Typography>
        </div>
      </div>
    </div>

    {/* PCO Integration - 4 Pillars */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-2">
        Built into Every PCO Shipment
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-6">
        PCOs are bespoke wine sourcing requests handled end-to-end by Craft & Culture. Each order
        gets full traceability from quote to delivery.
      </Typography>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconGlassFull} size="sm" className="text-emerald-500" />
            <Typography variant="bodySm" className="font-semibold">
              Sourcing
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            Source from our curated partner network across Europe and the New World. Any wine, any
            volume.
          </Typography>
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconTruck} size="sm" className="text-blue-500" />
            <Typography variant="bodySm" className="font-semibold">
              Logistics
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            Reefer containers with data loggers, customs clearance, and direct-to-cold-room
            receiving.
          </Typography>
        </div>

        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconSnowflake} size="sm" className="text-cyan-500" />
            <Typography variant="bodySm" className="font-semibold">
              Warehousing
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            12-14°C storage in our licensed & bonded warehouse. Every case barcoded and tracked in
            our WMS.
          </Typography>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconPackage} size="sm" className="text-amber-500" />
            <Typography variant="bodySm" className="font-semibold">
              Dispatch
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            Each case gets a branded label with a QR code for cold chain verification. Delivered to
            your door or distributor.
          </Typography>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
        <Typography variant="bodyXs" className="mb-2 font-semibold text-violet-600 dark:text-violet-400">
          PCO Features
        </Typography>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Order tracking dashboard',
            'Per-item stock status visibility',
            'Document management (invoices, proofs)',
            'Cold chain label on every case',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <Icon icon={IconCheck} size="xs" className="text-violet-500" />
              <Typography variant="bodyXs" colorRole="muted">
                {feature}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* The Label */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-2">
        The Label
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-6">
        What goes on every case
      </Typography>

      {/* Thermal Label Mockup */}
      <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow-lg">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
            C
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-900">
            Craft &<br />Culture
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-gray-300" />

        {/* Order + QR */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-gray-900">PCO-2026-042</p>
            <p className="text-xs text-gray-500">Total Order: 12 Cases</p>
            <p className="mt-2 text-sm font-bold text-gray-900">Distribution Partner</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-20 w-20 items-center justify-center rounded border border-gray-200 bg-gray-50">
              <Icon icon={IconQrcode} size="lg" className="text-gray-900" />
            </div>
            <p className="text-center text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              Scan to trace your case
            </p>
          </div>
        </div>

        {/* Product divider */}
        <div className="my-3 h-px bg-gray-200" />

        {/* Product details */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Ornellaia Bolgheri Superiore 2019</p>
            <p className="text-xs text-gray-500">6x750ml | 1 x case</p>
          </div>
          <p className="text-xs text-gray-500">Vintage: 2019</p>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center gap-4">
          <p className="text-xs text-gray-400">@wine.uae</p>
          <p className="text-xs text-gray-400">craftculture.xyz</p>
        </div>
      </div>

      <Typography variant="bodyXs" colorRole="muted" className="mt-3 text-center">
        Example Thermal Label
      </Typography>
    </div>

    {/* What the Customer Sees */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-2">
        What Your Customer Sees
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-6">
        Scanning the QR code opens a branded provenance page showing real-time cold room conditions
        and the full journey of their wine.
      </Typography>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconTemperature} size="sm" className="text-cyan-500" />
            <Typography variant="bodySm" className="font-medium">
              Live Temperature Dashboard
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            4-zone sensor data (front, rear, liquid, door) updating in real time. Current average:
            13.5°C.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconDroplet} size="sm" className="text-blue-500" />
            <Typography variant="bodySm" className="font-medium">
              Humidity & Air Quality
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            50-75% RH and CO₂ monitoring shown live. Proves conditions are right for fine wine
            storage.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconTruck} size="sm" className="text-amber-500" />
            <Typography variant="bodySm" className="font-medium">
              Provenance Journey
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            4-step visual timeline: sourcing, inspection, storage, delivery. Full chain of custody
            from winery to your door.
          </Typography>
        </div>

        <div className="rounded-lg bg-fill-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon={IconBuilding} size="sm" className="text-violet-500" />
            <Typography variant="bodySm" className="font-medium">
              Facility Details
            </Typography>
          </div>
          <Typography variant="bodyXs" colorRole="muted">
            12-14°C storage, dual compressor redundancy, licensed & bonded warehouse. Full spec
            transparency.
          </Typography>
        </div>
      </div>
    </div>

    {/* Technical Specifications */}
    <div className="rounded-xl border border-border-primary bg-fill-primary p-6">
      <Typography variant="headingSm" className="mb-4">
        Technical Specifications
      </Typography>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: IconQrcode, label: 'QR Code', value: 'Per-order scannable, linked to provenance page' },
          { icon: IconSnowflake, label: 'Cold Room', value: '12-14°C, 24/7 monitored' },
          { icon: IconTemperature, label: 'Sensors', value: '4-zone: temp, humidity, CO₂, air quality' },
          { icon: IconClock, label: 'Monitoring', value: 'Real-time alerts on threshold breach' },
          { icon: IconShieldCheck, label: 'Compliance', value: 'Licensed & bonded facility' },
          { icon: IconDroplet, label: 'Humidity', value: '50-75% RH, actively controlled' },
          { icon: IconCheck, label: 'Security', value: '24/7 CCTV & access control' },
          { icon: IconArrowRight, label: 'Traceability', value: 'Full chain: winery to delivery' },
        ].map((spec) => (
          <div key={spec.label} className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
            <Icon icon={spec.icon} size="sm" className="mt-0.5 text-cyan-500" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {spec.label}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {spec.value}
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* CTA */}
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 text-center">
      <Typography variant="headingSm" className="mb-2">
        Fine Wine Logistics, Done Right
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mb-4">
        Cold chain storage, digital warehouse management, and provenance verification for wine &
        spirits in the UAE and GCC.
      </Typography>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href="https://www.craftculture.xyz/cold-chain"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
        >
          <Icon icon={IconTemperature} size="sm" />
          View Live Cold Chain Page
        </a>
      </div>
    </div>
  </div>
);

const PcoFlowsPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'partner':
        return <PartnerTab />;
      case 'distributor':
        return <DistributorTab />;
      case 'admin':
        return <AdminTab />;
      case 'client':
        return <ClientTab />;
      case 'cold-chain':
        return <ColdChainTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-fill-brand p-2">
              <Icon icon={IconUsers} size="md" className="text-white" />
            </div>
            <div>
              <Typography variant="displaySm">PCO Process Flow</Typography>
              <Typography variant="bodySm" colorRole="muted">
                Private Client Orders - Complete End-to-End Guide
              </Typography>
            </div>
          </div>
          <Typography variant="bodyMd" colorRole="muted">
            This guide explains the full Private Client Orders (PCO) process from order creation to
            delivery. Select a tab to view the process from each participant&apos;s perspective.
          </Typography>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border-primary bg-fill-primary p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-fill-brand text-white'
                  : 'text-text-secondary hover:bg-fill-secondary hover:text-text-primary'
              }`}
            >
              <Icon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>{renderTabContent()}</div>

        {/* Footer */}
        <div className="mt-10 rounded-xl border border-border-primary bg-fill-primary p-6 text-center">
          <Typography variant="bodySm" colorRole="muted">
            Need help? Contact us at{' '}
            <a
              href="mailto:support@craftculture.xyz"
              className="font-medium text-text-brand hover:underline"
            >
              support@craftculture.xyz
            </a>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-2">
            © {new Date().getFullYear()} Craft & Culture. All rights reserved.
          </Typography>
          <button
            onClick={() => window.print()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fill-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-fill-brand/90 print:hidden"
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PcoFlowsPage;
