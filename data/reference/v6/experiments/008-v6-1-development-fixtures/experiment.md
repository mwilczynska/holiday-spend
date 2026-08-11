# Experiment 008 — v6.1 development fixtures

Status: generated from existing experiments; no collection.

This directory normalizes the 006 delegated Expedia/Numbeo/BudgetYourTrip responses and the 003 labelled BudgetYourTrip daily-tier panel into the v6.1 three-source response contract. It is an auditable Stage-A fixture set, not a new observation panel. Original search counts are retained in each response note and sidecar telemetry; v6.1 validation uses the new per-source limits.

The v6.1 materializer is the only Stage-B implementation used downstream. No holdout file or shipping CSV is read.
