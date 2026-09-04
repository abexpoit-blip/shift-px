/**
 * Adsterra & Meta Pixel Attribution & SubID Mapping Engine
 *
 * 1. Attribution Preservation:
 *    Preserves `fbclid`, `_fbp`, `_fbc`, `campaign_id`, `adset_id`, `ad_id`, and all `utm_*` parameters.
 * 2. Adsterra SubID Auto-Mapping:
 *    Maps:
 *      - `subid`   -> fbclid (or unique click ID)
 *      - `subid2`  -> utm_campaign || campaign_id
 *      - `subid3`  -> adset_id || utm_medium
 *      - `subid4`  -> ad_id || utm_content
 *      - `subid5`  -> country || device
 */

export interface AttributionParams {
  fbclid?: string | null;
  _fbp?: string | null;
  _fbc?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  country?: string | null;
  device?: string | null;
  allSearchParams?: Record<string, string>;
}

export function extractAttributionFromUrl(
  url: URL,
  extra?: { country?: string; device?: string },
): AttributionParams {
  const sp = url.searchParams;
  const allSearchParams: Record<string, string> = {};

  sp.forEach((value, key) => {
    allSearchParams[key] = value;
  });

  return {
    fbclid: sp.get("fbclid") || sp.get("fb_click_id") || null,
    _fbp: sp.get("_fbp") || null,
    _fbc: sp.get("_fbc") || null,
    campaign_id: sp.get("campaign_id") || sp.get("campaignId") || sp.get("campaign") || null,
    adset_id: sp.get("adset_id") || sp.get("adsetId") || null,
    ad_id: sp.get("ad_id") || sp.get("adId") || null,
    utm_source: sp.get("utm_source") || null,
    utm_medium: sp.get("utm_medium") || null,
    utm_campaign: sp.get("utm_campaign") || null,
    utm_term: sp.get("utm_term") || null,
    utm_content: sp.get("utm_content") || null,
    country: extra?.country || null,
    device: extra?.device || null,
    allSearchParams,
  };
}

/**
 * Builds the destination offer URL with preserved attribution and mapped Adsterra SubIDs.
 */
export function buildAdsterraOfferUrl(
  destinationUrl: string,
  attribution: AttributionParams,
): string {
  if (!destinationUrl) return destinationUrl;

  try {
    const raw = destinationUrl.trim();
    const normalizedDest = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const targetUrl = new URL(normalizedDest);

    // 1. Forward all incoming query parameters so nothing is lost
    if (attribution.allSearchParams) {
      Object.entries(attribution.allSearchParams).forEach(([key, val]) => {
        if (!targetUrl.searchParams.has(key) && val) {
          targetUrl.searchParams.set(key, val);
        }
      });
    }

    // 2. Auto-map Adsterra SubIDs for conversion & postback tracking
    // SubID 1: fbclid / click ID
    if (!targetUrl.searchParams.has("subid") && !targetUrl.searchParams.has("sub_id_1")) {
      if (attribution.fbclid) {
        targetUrl.searchParams.set("subid", attribution.fbclid);
      }
    }

    // SubID 2: Campaign Name / Campaign ID
    if (!targetUrl.searchParams.has("subid2") && !targetUrl.searchParams.has("sub_id_2")) {
      const camp = attribution.utm_campaign || attribution.campaign_id;
      if (camp) {
        targetUrl.searchParams.set("subid2", camp);
      }
    }

    // SubID 3: AdSet ID / Medium
    if (!targetUrl.searchParams.has("subid3") && !targetUrl.searchParams.has("sub_id_3")) {
      const adset = attribution.adset_id || attribution.utm_medium;
      if (adset) {
        targetUrl.searchParams.set("subid3", adset);
      }
    }

    // SubID 4: Ad ID / Content
    if (!targetUrl.searchParams.has("subid4") && !targetUrl.searchParams.has("sub_id_4")) {
      const ad = attribution.ad_id || attribution.utm_content;
      if (ad) {
        targetUrl.searchParams.set("subid4", ad);
      }
    }

    // Do not inject artificial subid5: preserving clean Adsterra link avoids subid penalty and maximizes CPM
    return targetUrl.toString();
  } catch {
    const raw = destinationUrl.trim();
    return /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  }
}

/**
 * Injects Meta Pixel tag into safe page / prelanding HTML if pixel ID is configured.
 */
export function injectMetaPixel(
  html: string,
  pixelId?: string | null,
  eventName: string = "PageView",
): string {
  if (!pixelId || !pixelId.trim()) return html;
  const cleanId = pixelId.trim();

  const pixelSnippet = `
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${cleanId}');
fbq('track', '${eventName}');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${cleanId}&ev=${eventName}&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
`;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${pixelSnippet}\n</head>`);
  }
  return pixelSnippet + html;
}
