/**
 * PepLab Mock Server
 * Serves realistic dummy data for all API endpoints so the frontend
 * can be tested visually without a real backend.
 *
 * Run: node server.js  (or: node --watch server.js)
 * Listens on: http://localhost:3000
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const LABS = [
  {
    id: 'lab-1',
    name: 'Informed Sport',
    phone_number: '+1-800-555-0100',
    country: 'US',
    address: '123 Lab Ave, Austin, TX',
    is_approved: true,
    approved_at: '2025-01-15T00:00:00.000Z',
    created_at: '2025-01-10T00:00:00.000Z',
  },
  {
    id: 'lab-2',
    name: 'ChromaDex Analytics',
    phone_number: '+1-800-555-0200',
    country: 'US',
    address: '456 Science Blvd, Irvine, CA',
    is_approved: true,
    approved_at: '2025-02-01T00:00:00.000Z',
    created_at: '2025-01-20T00:00:00.000Z',
  },
  {
    id: 'lab-3',
    name: 'Eurofins Nutrition',
    phone_number: '+1-800-555-0300',
    country: 'US',
    address: '789 Research Rd, Des Moines, IA',
    is_approved: true,
    approved_at: '2025-03-01T00:00:00.000Z',
    created_at: '2025-02-15T00:00:00.000Z',
  },
];

const LAB_TESTS = {
  'lab-1': [
    {
      id: 'lt-1',
      lab_id: 'lab-1',
      test_id: 'test-1',
      test_name: 'Heavy Metals Panel',
      price_usd: 140.0,
      typical_turnaround_days: 14,
    },
    {
      id: 'lt-2',
      lab_id: 'lab-1',
      test_id: 'test-2',
      test_name: 'Microbiology Screen',
      price_usd: 95.0,
      typical_turnaround_days: 10,
    },
    {
      id: 'lt-3',
      lab_id: 'lab-1',
      test_id: 'test-3',
      test_name: 'Purity by HPLC',
      price_usd: 185.0,
      typical_turnaround_days: 7,
    },
    {
      id: 'lt-4',
      lab_id: 'lab-1',
      test_id: 'test-4',
      test_name: 'Pesticide Residues',
      price_usd: 210.0,
      typical_turnaround_days: 21,
    },
  ],
  'lab-2': [
    {
      id: 'lt-5',
      lab_id: 'lab-2',
      test_id: 'test-1',
      test_name: 'Heavy Metals Panel',
      price_usd: 155.0,
      typical_turnaround_days: 12,
    },
    {
      id: 'lt-6',
      lab_id: 'lab-2',
      test_id: 'test-5',
      test_name: 'Amino Acid Profile',
      price_usd: 125.0,
      typical_turnaround_days: 8,
    },
    {
      id: 'lt-7',
      lab_id: 'lab-2',
      test_id: 'test-6',
      test_name: 'Vitamin D Assay',
      price_usd: 80.0,
      typical_turnaround_days: 5,
    },
  ],
  'lab-3': [
    {
      id: 'lt-8',
      lab_id: 'lab-3',
      test_id: 'test-2',
      test_name: 'Microbiology Screen',
      price_usd: 88.0,
      typical_turnaround_days: 9,
    },
    {
      id: 'lt-9',
      lab_id: 'lab-3',
      test_id: 'test-7',
      test_name: 'Steroids Screen',
      price_usd: 320.0,
      typical_turnaround_days: 18,
    },
    {
      id: 'lt-10',
      lab_id: 'lab-3',
      test_id: 'test-3',
      test_name: 'Purity by HPLC',
      price_usd: 175.0,
      typical_turnaround_days: 7,
    },
  ],
};

const TESTS = [
  {
    id: 'test-1',
    name: 'Heavy Metals Panel',
    description: 'Tests for lead, arsenic, cadmium, mercury per USP <232>.',
    usp_code: 'USP <232>',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-2',
    name: 'Microbiology Screen',
    description: 'Aerobic plate count, yeast, mold.',
    usp_code: 'USP <61>',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-3',
    name: 'Purity by HPLC',
    description: 'High-performance liquid chromatography purity assay.',
    usp_code: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-4',
    name: 'Pesticide Residues',
    description: 'Multi-residue pesticide screen.',
    usp_code: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-5',
    name: 'Amino Acid Profile',
    description: 'Complete amino acid profile by ion exchange.',
    usp_code: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-6',
    name: 'Vitamin D Assay',
    description: 'Quantification of D2 and D3 by LC-MS/MS.',
    usp_code: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-7',
    name: 'Steroids Screen',
    description: 'Anabolic steroid panel.',
    usp_code: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
];

const CAMPAIGNS = [
  {
    id: 'camp-1',
    title: 'Test My BPC-157 Peptide — Purity & Heavy Metals',
    description:
      "## Why This Matters\n\nI purchased BPC-157 from three separate vendors and want to verify purity levels and rule out heavy metal contamination before use.\n\n## What We're Testing\n\n- **Purity by HPLC** — minimum 98% expected\n- **Heavy Metals Panel** — USP <232> limits\n\nResults will be posted publicly for the community.",
    status: 'created',
    creator: { id: 'user-1', username: 'peptide_pete', successful_campaigns: 3 },
    verification_code: 4829,
    amount_requested_usd: 520.0,
    estimated_lab_cost_usd: 325.0,
    current_funding_usd: 187.5,
    funding_threshold_usd: 364.0,
    funding_threshold_percent: 70,
    funding_progress_percent: 51.5,
    platform_fee_percent: 5,
    is_flagged_for_review: false,
    flagged_reason: null,
    is_itemized: false,
    itemization_data: null,
    reactions: { thumbs_up: 24, rocket: 11, praising_hands: 8, mad: 1, fire: 15 },
    my_reaction: null,
    deadlines: {
      fundraising: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
      ship_samples: null,
      publish_results: null,
    },
    timestamps: {
      created_at: '2025-06-01T00:00:00.000Z',
      funded_at: null,
      locked_at: null,
      samples_sent_at: null,
      results_published_at: null,
      resolved_at: null,
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: [
      'Sample A (Pure Rawz)',
      'Sample B (Peptide Sciences)',
      'Sample C (Amino Asylum)',
    ],
    time_remaining_seconds: 8 * 24 * 3600,
    is_hidden: false,
    samples: [
      {
        id: 'samp-1a',
        vendor_name: 'Pure Rawz',
        purchase_date: '2025-05-15',
        physical_description: 'White lyophilized powder',
        sample_label: 'Sample A (Pure Rawz)',
        order_index: 0,
        target_lab: { id: 'lab-1', name: 'Informed Sport' },
        claims: [
          {
            id: 'cl-1',
            claim_type: 'mass',
            mass_amount: 5,
            mass_unit: 'mg',
            other_description: null,
          },
        ],
        tests: [
          { id: 'st-1', test_id: 'test-3', name: 'Purity by HPLC', usp_code: null },
          { id: 'st-2', test_id: 'test-1', name: 'Heavy Metals Panel', usp_code: 'USP <232>' },
        ],
        coa: null,
      },
      {
        id: 'samp-1b',
        vendor_name: 'Peptide Sciences',
        purchase_date: '2025-05-16',
        physical_description: 'White lyophilized powder',
        sample_label: 'Sample B (Peptide Sciences)',
        order_index: 1,
        target_lab: { id: 'lab-1', name: 'Informed Sport' },
        claims: [
          {
            id: 'cl-2',
            claim_type: 'mass',
            mass_amount: 5,
            mass_unit: 'mg',
            other_description: null,
          },
        ],
        tests: [{ id: 'st-3', test_id: 'test-3', name: 'Purity by HPLC', usp_code: null }],
        coa: null,
      },
      {
        id: 'samp-1c',
        vendor_name: 'Amino Asylum',
        purchase_date: '2025-05-17',
        physical_description: 'White lyophilized powder',
        sample_label: 'Sample C (Amino Asylum)',
        order_index: 2,
        target_lab: { id: 'lab-2', name: 'ChromaDex Analytics' },
        claims: [
          {
            id: 'cl-3',
            claim_type: 'mass',
            mass_amount: 5,
            mass_unit: 'mg',
            other_description: null,
          },
        ],
        tests: [
          { id: 'st-4', test_id: 'test-3', name: 'Purity by HPLC', usp_code: null },
          { id: 'st-5', test_id: 'test-1', name: 'Heavy Metals Panel', usp_code: 'USP <232>' },
        ],
        coa: null,
      },
    ],
    updates: [
      {
        id: 'upd-1',
        campaign_id: 'camp-1',
        author_id: 'user-1',
        content:
          "Just launched the campaign! All three vendors claim >98% purity. Let's verify that.",
        update_type: 'text',
        state_change_from: null,
        state_change_to: null,
        created_at: '2025-06-01T10:00:00.000Z',
      },
    ],
  },
  {
    id: 'camp-2',
    title: 'TB-500 Vendor Comparison — 4 Sources Tested',
    description:
      '## Background\n\nTB-500 is widely used but vendor quality varies enormously. This campaign tests 4 common vendors for purity, sterility, and correct peptide sequence.\n\n## Testing Plan\n\n1. HPLC purity (>95% target)\n2. Mass spectrometry confirmation of sequence\n3. Endotoxin test',
    status: 'funded',
    creator: { id: 'user-2', username: 'lab_rat_rex', successful_campaigns: 7 },
    verification_code: 7231,
    amount_requested_usd: 1200.0,
    estimated_lab_cost_usd: 840.0,
    current_funding_usd: 1200.0,
    funding_threshold_usd: 840.0,
    funding_threshold_percent: 70,
    funding_progress_percent: 143.0,
    platform_fee_percent: 5,
    is_flagged_for_review: false,
    flagged_reason: null,
    is_itemized: true,
    itemization_data: { note: 'Per-vendor cost breakdown available' },
    reactions: { thumbs_up: 89, rocket: 42, praising_hands: 31, mad: 3, fire: 58 },
    my_reaction: 'rocket',
    deadlines: {
      fundraising: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      ship_samples: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      publish_results: null,
    },
    timestamps: {
      created_at: '2025-05-20T00:00:00.000Z',
      funded_at: '2025-06-02T00:00:00.000Z',
      locked_at: '2025-05-21T00:00:00.000Z',
      samples_sent_at: null,
      results_published_at: null,
      resolved_at: null,
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: ['TB500-A', 'TB500-B', 'TB500-C', 'TB500-D'],
    time_remaining_seconds: 0,
    is_hidden: false,
    samples: [
      {
        id: 'samp-2a',
        vendor_name: 'Limitless Life Nootropics',
        purchase_date: '2025-05-18',
        physical_description: '2mg vial, lyophilized',
        sample_label: 'TB500-A',
        order_index: 0,
        target_lab: { id: 'lab-2', name: 'ChromaDex Analytics' },
        claims: [
          {
            id: 'cl-4',
            claim_type: 'mass',
            mass_amount: 2,
            mass_unit: 'mg',
            other_description: null,
          },
        ],
        tests: [{ id: 'st-6', test_id: 'test-3', name: 'Purity by HPLC', usp_code: null }],
        coa: null,
      },
      {
        id: 'samp-2b',
        vendor_name: 'Peptide Sciences',
        purchase_date: '2025-05-18',
        physical_description: '2mg vial, lyophilized',
        sample_label: 'TB500-B',
        order_index: 1,
        target_lab: { id: 'lab-2', name: 'ChromaDex Analytics' },
        claims: [
          {
            id: 'cl-5',
            claim_type: 'mass',
            mass_amount: 2,
            mass_unit: 'mg',
            other_description: null,
          },
        ],
        tests: [{ id: 'st-7', test_id: 'test-3', name: 'Purity by HPLC', usp_code: null }],
        coa: null,
      },
    ],
    updates: [
      {
        id: 'upd-2',
        campaign_id: 'camp-2',
        author_id: 'user-2',
        content:
          'Campaign fully funded in 12 days — thank you everyone! Samples are being prepared for shipment.',
        update_type: 'text',
        state_change_from: null,
        state_change_to: null,
        created_at: '2025-06-02T14:00:00.000Z',
      },
      {
        id: 'upd-3',
        campaign_id: 'camp-2',
        author_id: 'user-2',
        content: 'Samples sent to ChromaDex today. Tracking: 1Z999AA10123456784',
        update_type: 'text',
        state_change_from: null,
        state_change_to: null,
        created_at: '2025-06-05T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'camp-3',
    title: 'Semax Nasal Spray — Sterility & Correct Sequence Verification',
    description:
      'Semax nasal sprays from two vendors. Testing sterility and peptide sequence confirmation by LC-MS/MS.',
    status: 'samples_sent',
    creator: { id: 'user-3', username: 'nootropic_nerd', successful_campaigns: 2 },
    verification_code: 1337,
    amount_requested_usd: 750.0,
    estimated_lab_cost_usd: 500.0,
    current_funding_usd: 750.0,
    funding_threshold_usd: 500.0,
    funding_threshold_percent: 67,
    funding_progress_percent: 150.0,
    platform_fee_percent: 5,
    is_flagged_for_review: false,
    flagged_reason: null,
    is_itemized: false,
    itemization_data: null,
    reactions: { thumbs_up: 45, rocket: 23, praising_hands: 18, mad: 0, fire: 32 },
    my_reaction: 'thumbs_up',
    deadlines: {
      fundraising: null,
      ship_samples: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      publish_results: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
    },
    timestamps: {
      created_at: '2025-05-01T00:00:00.000Z',
      funded_at: '2025-05-15T00:00:00.000Z',
      locked_at: '2025-05-02T00:00:00.000Z',
      samples_sent_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      results_published_at: null,
      resolved_at: null,
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: ['Semax-A (CosmicNootropic)', 'Semax-B (Ceretropic)'],
    time_remaining_seconds: 21 * 24 * 3600,
    is_hidden: false,
    samples: [],
    updates: [
      {
        id: 'upd-4',
        campaign_id: 'camp-3',
        author_id: 'user-3',
        content: 'Samples shipped to Eurofins today. Expected results in 3 weeks.',
        update_type: 'text',
        state_change_from: 'funded',
        state_change_to: 'samples_sent',
        created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'camp-4',
    title: 'Creatine Monohydrate — Heavy Metals in Budget Brands',
    description:
      'Testing 5 budget creatine brands for heavy metal contamination. USP <232> limits apply.',
    status: 'results_published',
    creator: { id: 'user-4', username: 'gains_lab', successful_campaigns: 5 },
    verification_code: 9999,
    amount_requested_usd: 900.0,
    estimated_lab_cost_usd: 600.0,
    current_funding_usd: 900.0,
    funding_threshold_usd: 600.0,
    funding_threshold_percent: 67,
    funding_progress_percent: 150.0,
    platform_fee_percent: 5,
    is_flagged_for_review: false,
    flagged_reason: null,
    is_itemized: false,
    itemization_data: null,
    reactions: { thumbs_up: 156, rocket: 89, praising_hands: 72, mad: 8, fire: 104 },
    my_reaction: null,
    deadlines: { fundraising: null, ship_samples: null, publish_results: null },
    timestamps: {
      created_at: '2025-04-01T00:00:00.000Z',
      funded_at: '2025-04-15T00:00:00.000Z',
      locked_at: '2025-04-02T00:00:00.000Z',
      samples_sent_at: '2025-04-20T00:00:00.000Z',
      results_published_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      resolved_at: null,
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: [
      'NOW Sports',
      'Optimum Nutrition',
      'BulkSupplements',
      'Myprotein',
      'Store Brand',
    ],
    time_remaining_seconds: 0,
    is_hidden: false,
    samples: [
      {
        id: 'samp-4a',
        vendor_name: 'NOW Sports',
        purchase_date: '2025-04-10',
        physical_description: 'Fine white powder, 500g bag',
        sample_label: 'NOW Sports',
        order_index: 0,
        target_lab: { id: 'lab-1', name: 'Informed Sport' },
        claims: [
          {
            id: 'cl-10',
            claim_type: 'other',
            mass_amount: null,
            mass_unit: null,
            other_description: 'Pure Creatine Monohydrate',
          },
        ],
        tests: [
          { id: 'st-10', test_id: 'test-1', name: 'Heavy Metals Panel', usp_code: 'USP <232>' },
        ],
        coa: {
          id: 'coa-4a',
          sample_id: 'samp-4a',
          file_url: 'https://example.com/coa-4a.pdf',
          file_name: 'NOW-Sports-HeavyMetals.pdf',
          file_size_bytes: 245760,
          uploaded_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
          verification_status: 'code_found',
          verification_notes: 'All metals below USP <232> limits.',
          verified_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        },
      },
    ],
    updates: [
      {
        id: 'upd-5',
        campaign_id: 'camp-4',
        author_id: 'user-4',
        content:
          'Results are in! All 5 brands passed heavy metals testing. Full COA reports linked below.',
        update_type: 'text',
        state_change_from: null,
        state_change_to: null,
        created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'camp-5',
    title: 'GHK-Cu Copper Peptide — Contamination Concern',
    description:
      "Vendor X claims their GHK-Cu contains no heavy metals beyond safe limits, but multiple users reported skin reactions. Let's verify.",
    status: 'created',
    creator: { id: 'user-5', username: 'skin_science_sarah', successful_campaigns: 1 },
    verification_code: 2468,
    amount_requested_usd: 380.0,
    estimated_lab_cost_usd: 250.0,
    current_funding_usd: 42.0,
    funding_threshold_usd: 266.0,
    funding_threshold_percent: 70,
    funding_progress_percent: 15.8,
    platform_fee_percent: 5,
    is_flagged_for_review: true,
    flagged_reason: 'Product claim needs verification per community guidelines.',
    is_itemized: false,
    itemization_data: null,
    reactions: { thumbs_up: 18, rocket: 4, praising_hands: 12, mad: 5, fire: 9 },
    my_reaction: null,
    deadlines: {
      fundraising: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      ship_samples: null,
      publish_results: null,
    },
    timestamps: {
      created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      funded_at: null,
      locked_at: null,
      samples_sent_at: null,
      results_published_at: null,
      resolved_at: null,
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: ['GHK-Cu Batch A'],
    time_remaining_seconds: 14 * 24 * 3600,
    is_hidden: false,
    samples: [],
    updates: [],
  },
  {
    id: 'camp-6',
    title: 'Melanotan II — Sterility Panel on 3 Sources',
    description:
      'Testing MT2 peptides from three well-known online sources for sterility and sequence confirmation.',
    status: 'resolved',
    creator: { id: 'user-2', username: 'lab_rat_rex', successful_campaigns: 7 },
    verification_code: 5555,
    amount_requested_usd: 600.0,
    estimated_lab_cost_usd: 420.0,
    current_funding_usd: 630.0,
    funding_threshold_usd: 420.0,
    funding_threshold_percent: 70,
    funding_progress_percent: 150.0,
    platform_fee_percent: 5,
    is_flagged_for_review: false,
    flagged_reason: null,
    is_itemized: false,
    itemization_data: null,
    reactions: { thumbs_up: 203, rocket: 112, praising_hands: 98, mad: 11, fire: 167 },
    my_reaction: null,
    deadlines: { fundraising: null, ship_samples: null, publish_results: null },
    timestamps: {
      created_at: '2025-02-01T00:00:00.000Z',
      funded_at: '2025-02-10T00:00:00.000Z',
      locked_at: '2025-02-02T00:00:00.000Z',
      samples_sent_at: '2025-02-15T00:00:00.000Z',
      results_published_at: '2025-03-10T00:00:00.000Z',
      resolved_at: '2025-03-20T00:00:00.000Z',
      refunded_at: null,
    },
    refund_reason: null,
    sample_labels: ['MT2-Source1', 'MT2-Source2', 'MT2-Source3'],
    time_remaining_seconds: 0,
    is_hidden: false,
    samples: [],
    updates: [
      {
        id: 'upd-6',
        campaign_id: 'camp-6',
        author_id: 'user-2',
        content: 'Campaign resolved. All payouts complete. Thanks to all 47 contributors!',
        update_type: 'text',
        state_change_from: null,
        state_change_to: null,
        created_at: '2025-03-20T00:00:00.000Z',
      },
    ],
  },
];

const TRANSACTIONS = [
  {
    id: 'tx-1',
    transaction_type: 'deposit',
    amount: 500.0,
    currency: 'usdc',
    from_account_type: 'external',
    to_account_type: 'user',
    status: 'completed',
    onchain_signature: '5HxMockSig1',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-2',
    transaction_type: 'contribution',
    amount: 50.0,
    currency: 'usdc',
    from_account_type: 'user',
    to_account_type: 'campaign',
    status: 'completed',
    onchain_signature: null,
    created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-3',
    transaction_type: 'contribution',
    amount: 25.0,
    currency: 'usdt',
    from_account_type: 'user',
    to_account_type: 'campaign',
    status: 'completed',
    onchain_signature: null,
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-4',
    transaction_type: 'deposit',
    amount: 200.0,
    currency: 'usdt',
    from_account_type: 'external',
    to_account_type: 'user',
    status: 'confirmed',
    onchain_signature: '5HxMockSig2',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-5',
    transaction_type: 'withdrawal',
    amount: 100.0,
    currency: 'usdc',
    from_account_type: 'user',
    to_account_type: 'external',
    status: 'pending',
    onchain_signature: null,
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-6',
    transaction_type: 'fee',
    amount: 2.5,
    currency: 'usdc',
    from_account_type: 'campaign',
    to_account_type: 'fee',
    status: 'completed',
    onchain_signature: null,
    created_at: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-7',
    transaction_type: 'refund',
    amount: 10.0,
    currency: 'usdc',
    from_account_type: 'campaign',
    to_account_type: 'user',
    status: 'completed',
    onchain_signature: null,
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
];

const CONFIG = [
  {
    id: 'cfg-1',
    config_key: 'global_minimums',
    config_value: {
      min_contribution_usd: 1.0,
      min_funding_threshold_usd: 50.0,
      min_funding_threshold_percent: 5,
      min_withdrawal_usd: 5.0,
    },
    description: 'Global minimum amounts enforced on transactions.',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cfg-2',
    config_key: 'platform_fee_percent',
    config_value: 5,
    description: 'Platform fee percentage taken from funded campaigns.',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cfg-3',
    config_key: 'fundraising_deadline_days',
    config_value: 30,
    description: 'Default fundraising deadline in days after locking.',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
];

const NOTIFICATIONS = [
  {
    id: 'notif-1',
    user_id: 'user-me',
    notification_type: 'campaign_funded',
    campaign_id: 'camp-2',
    title: 'Campaign Funded!',
    message: 'TB-500 Vendor Comparison has been fully funded.',
    is_read: false,
    sent_email: true,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    read_at: null,
  },
  {
    id: 'notif-2',
    user_id: 'user-me',
    notification_type: 'deposit_confirmed',
    campaign_id: null,
    title: 'Deposit Confirmed',
    message: 'Your deposit of 200.00 USDT has been confirmed.',
    is_read: false,
    sent_email: false,
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    read_at: null,
  },
  {
    id: 'notif-3',
    user_id: 'user-me',
    notification_type: 'coa_uploaded',
    campaign_id: 'camp-4',
    title: 'COA Uploaded',
    message: 'Lab results have been uploaded for Creatine Monohydrate campaign.',
    is_read: true,
    sent_email: true,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    read_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginate(arr, page, limit) {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 20;
  const start = (p - 1) * l;
  return {
    data: arr.slice(start, start + l),
    total: arr.length,
    page: p,
    limit: l,
  };
}

function toCampaignListDto(c) {
  return {
    id: c.id,
    title: c.title,
    status: c.status,
    creator: { id: c.creator.id, username: c.creator.username },
    amount_requested_usd: c.amount_requested_usd,
    current_funding_usd: c.current_funding_usd,
    funding_threshold_usd: c.funding_threshold_usd,
    funding_progress_percent: c.funding_progress_percent,
    is_flagged_for_review: c.is_flagged_for_review,
    is_hidden: c.is_hidden,
    sample_labels: c.sample_labels,
    deadline_fundraising: c.deadlines.fundraising,
    time_remaining_seconds: c.time_remaining_seconds,
    created_at: c.timestamps.created_at,
  };
}

const FAKE_TOKEN = 'mock-access-token-peplab';
const FAKE_REFRESH = 'mock-refresh-token-peplab';

const ME_USER = {
  id: 'user-me',
  email: 'demo@peplab.app',
  username: 'demo_user',
  is_banned: false,
  email_verified: true,
  claims: ['campaign_creator', 'contributor', 'admin'],
  stats: {
    total_contributed_usd: 325.0,
    campaigns_created: 2,
    campaigns_successful: 1,
    campaigns_refunded: 0,
  },
  created_at: '2025-01-01T00:00:00.000Z',
};

// ─── App Info ─────────────────────────────────────────────────────────────────

app.get('/api/app-info', (_req, res) => {
  res.json({
    version: '1.0.0',
    network: 'devnet',
    usdc_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt_mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    minimums: {
      min_contribution_usd: 1.0,
      min_funding_threshold_usd: 50.0,
      min_funding_threshold_percent: 5,
      min_withdrawal_usd: 5.0,
    },
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (_req, res) => {
  res.json({ user: ME_USER, accessToken: FAKE_TOKEN, refreshToken: FAKE_REFRESH });
});

app.post('/api/auth/register', (_req, res) => {
  res.status(201).json({
    user: ME_USER,
    accessToken: FAKE_TOKEN,
    refreshToken: FAKE_REFRESH,
    depositAddress: 'SoL1naMockAddr3ss4PepL4bD3mo123456789abcdefgh',
  });
});

app.post('/api/auth/refresh', (_req, res) => {
  res.json({ accessToken: FAKE_TOKEN, refreshToken: FAKE_REFRESH });
});

app.post('/api/auth/logout', (_req, res) => res.status(204).send());

app.get('/api/auth/me', (_req, res) => res.json(ME_USER));

app.post('/api/auth/verify-email', (_req, res) =>
  res.json({ message: 'Email verified successfully' })
);

app.post('/api/auth/resend-verification', (_req, res) =>
  res.json({ message: 'Verification email sent' })
);

// ─── Campaigns ────────────────────────────────────────────────────────────────

app.get('/api/campaigns', (req, res) => {
  let list = [...CAMPAIGNS];
  const { status, search, sort } = req.query;

  if (status) list = list.filter((c) => c.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }
  if (sort === 'funding_progress_percent') {
    list.sort((a, b) => b.funding_progress_percent - a.funding_progress_percent);
  } else if (sort === 'deadline_fundraising') {
    list.sort((a, b) =>
      (a.deadlines.fundraising || '9') < (b.deadlines.fundraising || '9') ? -1 : 1
    );
  } else {
    list.sort((a, b) => (b.timestamps.created_at < a.timestamps.created_at ? -1 : 1));
  }

  const result = paginate(list, req.query.page, req.query.limit);
  result.data = result.data.map(toCampaignListDto);
  res.json(result);
});

app.get('/api/campaigns/me', (req, res) => {
  const mine = CAMPAIGNS.filter((c) => c.creator.id === 'user-1' || c.creator.id === 'user-me');
  const result = paginate(mine, req.query.page, req.query.limit);
  result.data = result.data.map(toCampaignListDto);
  res.json(result);
});

app.get('/api/campaigns/verification-code', (_req, res) => {
  res.json({ code: Math.floor(1000 + Math.random() * 9000) });
});

app.get('/api/campaigns/estimate-cost', (req, res) => {
  res.json({
    estimated_usd: 325.0,
    breakdown: [
      {
        lab_id: 'lab-1',
        lab_name: 'Informed Sport',
        test_id: 'test-3',
        test_name: 'Purity by HPLC',
        price_usd: 185.0,
      },
      {
        lab_id: 'lab-1',
        lab_name: 'Informed Sport',
        test_id: 'test-1',
        test_name: 'Heavy Metals Panel',
        price_usd: 140.0,
      },
    ],
  });
});

app.get('/api/campaigns/:id', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  res.json(campaign);
});

app.post('/api/campaigns', (req, res) => {
  const newCampaign = {
    ...CAMPAIGNS[0],
    id: `camp-new-${Date.now()}`,
    title: req.body.title || 'New Campaign',
    description: req.body.description || '',
    status: 'created',
    current_funding_usd: 0,
    funding_progress_percent: 0,
    reactions: { thumbs_up: 0, rocket: 0, praising_hands: 0, mad: 0, fire: 0 },
    my_reaction: null,
    timestamps: {
      created_at: new Date().toISOString(),
      funded_at: null,
      locked_at: null,
      samples_sent_at: null,
      results_published_at: null,
      resolved_at: null,
      refunded_at: null,
    },
    samples: [],
    updates: [],
  };
  res.status(201).json(newCampaign);
});

app.patch('/api/campaigns/:id', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json({ ...campaign, ...req.body });
});

app.delete('/api/campaigns/:id', (_req, res) => res.status(204).send());

app.post('/api/campaigns/:id/lock', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json({ ...campaign, status: 'funded' });
});

app.post('/api/campaigns/:id/ship-samples', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json({ ...campaign, status: 'samples_sent' });
});

app.get('/api/campaigns/:id/reactions', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json(campaign.reactions);
});

app.post('/api/campaigns/:id/reactions', (req, res) => {
  res.json({ reaction_type: req.body.reaction_type, created_at: new Date().toISOString() });
});

app.delete('/api/campaigns/:id/reactions/:type', (_req, res) => res.status(204).send());

app.get('/api/campaigns/:id/updates', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  const updates = campaign ? campaign.updates : [];
  res.json(paginate(updates, req.query.page, req.query.limit));
});

app.post('/api/campaigns/:id/updates', (req, res) => {
  res.json({
    id: `upd-${Date.now()}`,
    campaign_id: req.params.id,
    author_id: 'user-me',
    content: req.body.content,
    update_type: 'text',
    state_change_from: null,
    state_change_to: null,
    created_at: new Date().toISOString(),
  });
});

app.get('/api/campaigns/:id/coas', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  const coas = campaign ? campaign.samples.filter((s) => s.coa).map((s) => s.coa) : [];
  res.json(coas);
});

app.get('/api/campaigns/:id/contributions', (req, res) => {
  res.json(
    paginate(
      [
        {
          id: 'contrib-1',
          campaign_id: req.params.id,
          campaign_title: 'Mock Campaign',
          contributor: { id: 'user-2', username: 'lab_rat_rex' },
          amount_usd: 50.0,
          currency: 'usdc',
          status: 'completed',
          contributed_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          refunded_at: null,
        },
        {
          id: 'contrib-2',
          campaign_id: req.params.id,
          campaign_title: 'Mock Campaign',
          contributor: { id: 'user-3', username: 'nootropic_nerd' },
          amount_usd: 25.0,
          currency: 'usdt',
          status: 'completed',
          contributed_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          refunded_at: null,
        },
      ],
      req.query.page,
      req.query.limit
    )
  );
});

app.post('/api/campaigns/:id/contribute', (req, res) => {
  res.json({
    id: `contrib-${Date.now()}`,
    campaign_id: req.params.id,
    campaign_title: 'Mock Campaign',
    contributor: { id: 'user-me', username: 'demo_user' },
    amount_usd: req.body.amount,
    currency: req.body.currency,
    status: 'completed',
    contributed_at: new Date().toISOString(),
    refunded_at: null,
  });
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

app.get('/api/wallet/balance', (_req, res) => {
  res.json({ balance_usdc: 424.0, balance_usdt: 175.0 });
});

app.get('/api/wallet/deposit-address', (_req, res) => {
  res.json({
    address: 'SoL1naMockAddr3ss4PepL4bD3mo123456789abcdefgh',
    qr_hint: 'solana:SoL1naMockAddr3ss4PepL4bD3mo123456789abcdefgh',
  });
});

app.get('/api/wallet/transactions', (req, res) => {
  let txns = [...TRANSACTIONS];
  if (req.query.type) txns = txns.filter((t) => t.transaction_type === req.query.type);
  res.json(paginate(txns, req.query.page, req.query.limit));
});

app.post('/api/wallet/withdraw', (_req, res) => {
  res.json({ ledger_transaction_id: `tx-wd-${Date.now()}`, status: 'pending' });
});

// ─── Notifications ────────────────────────────────────────────────────────────

app.get('/api/notifications', (req, res) => {
  res.json(paginate(NOTIFICATIONS, req.query.page, req.query.limit));
});

app.get('/api/notifications/unread-count', (_req, res) => {
  res.json({ count: NOTIFICATIONS.filter((n) => !n.is_read).length });
});

app.patch('/api/notifications/:id/read', (req, res) => {
  const notif = NOTIFICATIONS.find((n) => n.id === req.params.id);
  if (!notif) return res.status(404).json({ message: 'Not found' });
  res.json({ ...notif, is_read: true, read_at: new Date().toISOString() });
});

app.patch('/api/notifications/read-all', (_req, res) => {
  res.json({ marked_count: NOTIFICATIONS.filter((n) => !n.is_read).length });
});

// ─── Labs ─────────────────────────────────────────────────────────────────────

app.get('/api/labs', (req, res) => {
  let labs = [...LABS];
  if (req.query.approved_only === 'true') labs = labs.filter((l) => l.is_approved);
  res.json(paginate(labs, req.query.page, req.query.limit));
});

app.get('/api/labs/:id', (req, res) => {
  const lab = LABS.find((l) => l.id === req.params.id);
  if (!lab) return res.status(404).json({ message: 'Not found' });
  res.json({ ...lab, tests: LAB_TESTS[req.params.id] || [] });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

app.get('/api/tests', (req, res) => {
  let tests = [...TESTS];
  if (req.query.active_only === 'true') tests = tests.filter((t) => t.is_active);
  res.json(tests);
});

// ─── Admin ────────────────────────────────────────────────────────────────────

app.get('/api/admin/campaigns', (req, res) => {
  let list = [...CAMPAIGNS];
  if (req.query.status) list = list.filter((c) => c.status === req.query.status);
  if (req.query.flagged === 'true') list = list.filter((c) => c.is_flagged_for_review);
  const result = paginate(list, req.query.page, req.query.limit);
  res.json(result);
});

app.post('/api/admin/campaigns/:id/refund', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json({ ...campaign, status: 'refunded', refund_reason: req.body.reason });
});

app.post('/api/admin/campaigns/:id/hide', (req, res) => {
  const campaign = CAMPAIGNS.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  res.json({ ...campaign, is_hidden: req.body.hidden });
});

app.post('/api/admin/coas/:id/verify', (req, res) => {
  res.json({
    id: req.params.id,
    sample_id: 'samp-1',
    file_url: 'https://example.com/coa.pdf',
    file_name: 'coa.pdf',
    file_size_bytes: 204800,
    uploaded_at: new Date().toISOString(),
    verification_status: req.body.status === 'approved' ? 'manually_approved' : 'rejected',
    verification_notes: req.body.notes || null,
    verified_at: new Date().toISOString(),
  });
});

app.post('/api/admin/users/:id/ban', (req, res) => {
  res.json({ ...ME_USER, id: req.params.id, is_banned: req.body.banned });
});

app.post('/api/admin/users/:id/claims', (req, res) => {
  res.json({ ...ME_USER, id: req.params.id });
});

app.get('/api/admin/config', (_req, res) => res.json(CONFIG));

app.put('/api/admin/config/:key', (req, res) => {
  const cfg = CONFIG.find((c) => c.config_key === req.params.key);
  if (!cfg) return res.status(404).json({ message: 'Not found' });
  res.json({ ...cfg, config_value: req.body.value, updated_at: new Date().toISOString() });
});

app.post('/api/admin/fee-sweep', (_req, res) => {
  res.json({ ledger_transaction_id: `tx-sweep-${Date.now()}` });
});

// ─── Users ────────────────────────────────────────────────────────────────────

app.get('/api/users/me', (_req, res) => res.json(ME_USER));

app.patch('/api/users/me', (req, res) => res.json({ ...ME_USER, ...req.body }));

app.patch('/api/users/me/notification-preferences', (_req, res) => res.json(ME_USER));

app.get('/api/users/:id/profile', (req, res) => {
  res.json({
    id: req.params.id,
    username: 'mock_user',
    stats: { total_contributed_usd: 150, campaigns_created: 2, campaigns_successful: 1 },
    created_at: '2025-01-01T00:00:00.000Z',
  });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

app.get('/api/leaderboard/contributors', (_req, res) => {
  res.json([
    { rank: 1, user: { id: 'user-2', username: 'lab_rat_rex' }, value: 1500.0, period: 'all' },
    { rank: 2, user: { id: 'user-4', username: 'gains_lab' }, value: 890.0, period: 'all' },
    { rank: 3, user: { id: 'user-me', username: 'demo_user' }, value: 325.0, period: 'all' },
  ]);
});

app.get('/api/leaderboard/creators', (_req, res) => {
  res.json([
    { rank: 1, user: { id: 'user-2', username: 'lab_rat_rex' }, value: 7, period: 'all' },
    { rank: 2, user: { id: 'user-4', username: 'gains_lab' }, value: 5, period: 'all' },
  ]);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🧪 PepLab Mock Server running at http://localhost:${PORT}`);
  console.log(`   All API endpoints return realistic dummy data.`);
  console.log(`   Login with any email/password — returns demo_user (admin).`);
  console.log(`\n   Start the FE dev server in another terminal:`);
  console.log(`   pnpm dev:fe   →  http://localhost:5173\n`);
});
