'use client';

import { useEffect, useRef, useState } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';

export interface TermsViewerProps {
  onScrollToBottom: (reached: boolean) => void;
}

/**
 * Scrollable Terms and Conditions viewer with scroll tracking
 */
const TermsViewer = ({ onScrollToBottom }: TermsViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
        onScrollToBottom(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasScrolledToBottom, onScrollToBottom]);

  return (
    <div className='flex flex-col gap-4'>
      <div
        ref={containerRef}
        className='h-[400px] overflow-y-auto rounded-lg border border-border-primary bg-fill-secondary p-6'
      >
        <div className='prose prose-sm max-w-none'>
          <Typography variant='displaySm' className='mb-2'>
            Terms and Conditions
          </Typography>
          <Typography variant='bodySm' colorRole='muted' className='mb-6'>
            Last Updated: January 2025
          </Typography>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              1. Introduction
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              Welcome to Craft & Culture Index (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
              These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of our
              wine and spirits trading platform (the &quot;Platform&quot; or
              &quot;Service&quot;).
            </Typography>
            <Typography variant='bodySm'>
              By creating an account or using our Platform, you agree to be bound by these Terms. If
              you do not agree to these Terms, please do not use our Service.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              2. Important Platform Notice
            </Typography>
            <Typography variant='bodySm' className='mb-2 font-medium'>
              2.1 Nature of the Platform
            </Typography>
            <Typography variant='bodySm' className='mb-2 font-semibold'>
              IMPORTANT: This Platform is a pricing calculator and quotation tool only, NOT a sales
              fulfillment system.
            </Typography>
            <Typography variant='bodySm' className='mb-2'>
              By accessing or using this Platform, you acknowledge and agree that:
            </Typography>
            <ul className='mb-3 ml-4 list-disc space-y-1'>
              <li>
                <Typography variant='bodySm'>
                  The Platform is designed solely to generate price quotations and estimates for
                  wine and spirits products
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  The Platform does NOT process sales transactions, accept orders, or fulfill
                  purchases directly
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  All quotes generated are for informational purposes and require separate
                  confirmation and order processing
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  Actual sales transactions are conducted separately outside of this Platform
                  through direct communication with our sales team
                </Typography>
              </li>
            </ul>

            <Typography variant='bodySm' className='mb-2 font-medium'>
              2.2 Access Restrictions
            </Typography>
            <Typography variant='bodySm' className='mb-2 font-semibold'>
              This Platform is NOT publicly accessible.
            </Typography>
            <Typography variant='bodySm' className='mb-2'>
              You acknowledge and agree that:
            </Typography>
            <ul className='mb-3 ml-4 list-disc space-y-1'>
              <li>
                <Typography variant='bodySm'>
                  Access to this Platform is restricted to registered businesses and approved
                  individual users only
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  The Platform is a private business tool, not a public-facing e-commerce website
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  Account registration requires approval and verification
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  We reserve the right to restrict or terminate access at our sole discretion
                </Typography>
              </li>
            </ul>

            <Typography variant='bodySm' className='mb-2 font-medium'>
              2.3 User Acknowledgment
            </Typography>
            <Typography variant='bodySm' className='mb-2'>
              By using this Platform, you explicitly acknowledge that:
            </Typography>
            <ul className='mb-3 ml-4 list-disc space-y-1'>
              <li>
                <Typography variant='bodySm'>
                  You understand this is a pricing calculator tool, not a sales platform
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  You will not treat quotes as binding purchase orders
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  You will contact our sales team directly for actual order placement and
                  fulfillment
                </Typography>
              </li>
              <li>
                <Typography variant='bodySm'>
                  The Platform is for authorized business use only
                </Typography>
              </li>
            </ul>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              3. Eligibility and Account Registration
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              You must be at least 21 years of age (or the legal drinking age in your jurisdiction,
              whichever is higher) to create an account and use our Platform.
            </Typography>
            <Typography variant='bodySm'>
              You must provide accurate, current, and complete information during registration. You
              are responsible for maintaining the confidentiality of your account credentials and
              agree to immediately notify us of any unauthorized use of your account.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              4. Products and Pricing
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              All prices are quoted in the currency specified (USD or AED) and are subject to
              change without notice. Quotes generated through the Platform are valid for the period
              specified (typically 7 days unless otherwise stated).
            </Typography>
            <Typography variant='bodySm'>
              Quotes are price estimates only and do not constitute binding purchase orders. Orders
              are subject to acceptance, inventory availability, and payment verification.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              5. Payment Processing
            </Typography>
            <Typography variant='bodySm' className='mb-2 font-semibold'>
              IMPORTANT: Craft & Culture does not directly handle transactions or process payments.
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              All payment processing and financial transactions are conducted through our licensed
              distribution partners who hold the appropriate licenses to sell alcoholic beverages
              in their respective jurisdictions. Payment details, including bank transfer
              information for our licensed partners, will be provided in your confirmed quote.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              6. Limitation of Liability
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS
              WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              7. Governing Law
            </Typography>
            <Typography variant='bodySm' className='mb-3'>
              These Terms shall be governed by and construed in accordance with the laws of the
              United Arab Emirates. Any legal action or proceeding relating to these Terms shall be
              brought exclusively in the courts of Dubai, UAE.
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodyMd' className='mb-2 font-semibold'>
              8. Contact Information
            </Typography>
            <Typography variant='bodySm'>
              For questions about these Terms, please contact us at{' '}
              <a href='mailto:support@craftculture.xyz' className='text-text-brand'>
                support@craftculture.xyz
              </a>
            </Typography>
          </section>

          <section className='mb-6'>
            <Typography variant='bodySm' className='italic'>
              For the complete Terms of Use, please{' '}
              <a
                href='/platform/terms-of-use'
                target='_blank'
                rel='noopener noreferrer'
                className='text-text-brand'
              >
                view the full document
              </a>
              .
            </Typography>
          </section>
        </div>
      </div>
      {!hasScrolledToBottom && (
        <Typography variant='bodySm' colorRole='muted' className='text-center'>
          Please scroll to the bottom to continue
        </Typography>
      )}
    </div>
  );
};

export default TermsViewer;
