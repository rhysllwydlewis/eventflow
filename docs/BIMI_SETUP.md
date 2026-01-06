# BIMI Setup for EventFlow

## Overview

BIMI (Brand Indicators for Message Identification) allows your brand logo to appear next to emails in supported email clients (Gmail, Yahoo, etc.). This document provides instructions for configuring BIMI DNS records for `event-flow.co.uk`.

## Prerequisites

### DMARC Policy
BIMI requires a DMARC policy with enforcement enabled. Your domain must have a DMARC TXT record with either:
- `p=quarantine` (recommended minimum), or
- `p=reject` (highest security)

You can check your current DMARC policy at: `_dmarc.event-flow.co.uk`

### Logo Requirements
The BIMI logo must be:
- SVG format (SVG Tiny PS profile)
- Served over HTTPS
- Square aspect ratio (recommended)
- Publicly accessible without authentication

EventFlow's BIMI logo is available at: `https://event-flow.co.uk/bimi.svg`

## DNS Configuration

### Add BIMI TXT Record

Add the following DNS TXT record to your domain:

**Host/Name:**
```
default._bimi
```

**Value:**
```
v=BIMI1; l=https://event-flow.co.uk/bimi.svg;
```

**TTL:** 3600 (or your default)

### DNS Record Details
- `v=BIMI1` - BIMI version
- `l=` - Location of the logo SVG file (must be HTTPS)

### Optional: Verified Mark Certificate (VMC)
Some email providers (especially Gmail for organizational accounts) require a Verified Mark Certificate (VMC). This is a digitally signed certificate that proves trademark ownership.

To add a VMC, modify the BIMI record to include the `a=` parameter:
```
v=BIMI1; l=https://event-flow.co.uk/bimi.svg; a=https://example.com/certificate.pem;
```

VMCs are issued by authorized providers (e.g., DigiCert, Entrust) and typically cost several hundred dollars annually.

## Verification Steps

### 1. Verify DNS Record Propagation
Use a DNS lookup tool to verify your BIMI record:
```bash
nslookup -type=TXT default._bimi.event-flow.co.uk
```

Or use an online DNS checker.

### 2. Verify Logo Accessibility
Confirm the logo is publicly accessible:
```bash
curl -I https://event-flow.co.uk/bimi.svg
```

Should return `200 OK` with `Content-Type: image/svg+xml`

### 3. Test BIMI Implementation
Use these tools to validate your BIMI setup:
- [BIMI Group Inspector](https://bimigroup.org/bimi-generator/)
- [MXToolbox BIMI Lookup](https://mxtoolbox.com/bimi.aspx)
- Send a test email to a Gmail or Yahoo account and check if the logo appears

### 4. Timeline
BIMI display can take time:
- DNS propagation: Up to 48 hours (usually much faster)
- Email provider caching: Several hours to days
- Logo appears gradually as email reputation builds

## Troubleshooting

### Logo Not Appearing
1. **Check DMARC policy**: Must be `p=quarantine` or `p=reject`
2. **Verify DNS record**: Use DNS lookup tools to confirm proper configuration
3. **Check SVG accessibility**: Ensure HTTPS, no authentication required
4. **Validate SVG format**: Must be SVG Tiny PS profile (no scripts, external refs, or animations)
5. **Domain reputation**: New domains may take time to build reputation

### Common Issues
- **Mixed content**: Ensure logo URL uses HTTPS, not HTTP
- **SVG validation errors**: Check that SVG complies with Tiny PS profile
- **DNS propagation**: Allow 24-48 hours for full propagation
- **Gmail organizational accounts**: May require VMC

## Resources

- [BIMI Group Official Site](https://bimigroup.org/)
- [BIMI Specification](https://bimigroup.org/resources/rfc-explainer/)
- [Google BIMI FAQ](https://support.google.com/a/answer/10911320)

## Support

For technical assistance with EventFlow's BIMI implementation, contact the development team or open an issue in the repository.

---

**Last Updated:** January 2026
