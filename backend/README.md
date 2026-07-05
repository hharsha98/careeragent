---
title: CareerAgent API
emoji: 🧭
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# CareerAgent — backend

FastAPI backend for [CareerAgent](https://github.com/hharsha98/careeragent):
RAG chat with citations, web-research + CV-tailoring agents, application
tracker, LLM-as-judge evals, and per-request cost metering.

This directory is deployed as a Docker Space (the front-matter above tells
Hugging Face how to run it). Secrets are configured as Space secrets — see
`.env.example` for the names. Full documentation lives in the main repo README.
