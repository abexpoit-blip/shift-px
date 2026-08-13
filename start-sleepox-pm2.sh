#!/usr/bin/env bash
pm2 delete sleepox || true
pm2 start ecosystem.config.cjs
pm2 save
