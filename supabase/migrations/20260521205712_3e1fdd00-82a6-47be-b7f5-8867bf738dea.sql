REVOKE ALL ON TABLE
  public.admin_audit_logs,
  public.payment_settings,
  public.plisio_webhook_logs,
  public.plisio_activity_log,
  public.plisio_webhook_retry_queue,
  public.bot_protection_config,
  public.fb_asn_blocklist,
  public.referer_rules,
  public.shared_domains,
  public.domain_health_checks,
  public.duplicate_clicks
FROM anon;

NOTIFY pgrst, 'reload schema';