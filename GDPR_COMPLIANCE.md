# GDPR Compliance Documentation

## Overview
EventFlow is committed to protecting user data and complying with the General Data Protection Regulation (GDPR) and other data protection laws.

## Data Controller Information

**Organization:** EventFlow  
**Contact:** admin@event-flow.co.uk  
**Data Protection Officer:** To be designated  

## Personal Data We Collect

### User Accounts
- **Identity Data:** Name, email address
- **Account Data:** User ID, password (hashed), role, verification status
- **Usage Data:** Last login date, join date, marketing preferences
- **Profile Data:** User preferences, saved plans, notes

### Supplier Accounts
- **Business Data:** Supplier name, description, contact information
- **Location Data:** Business address, service areas
- **Commercial Data:** Packages, pricing, availability
- **Performance Data:** Reviews, ratings, health score

### Customer Data
- **Planning Data:** Event plans, budgets, guest lists
- **Communication Data:** Messages, threads
- **Preference Data:** Saved suppliers, comparisons

### Photos and Media
- **Photo Data:** Uploaded images, metadata
- **Attribution:** Supplier association, upload date
- **Moderation Status:** Approval status, rejection reasons

## Legal Basis for Processing

We process personal data under the following lawful bases:

1. **Consent:** Marketing communications (opt-in required)
2. **Contract Performance:** Account creation, service delivery
3. **Legitimate Interests:** Platform security, fraud prevention
4. **Legal Obligation:** Compliance with applicable laws

## Data Storage and Security

### Storage Infrastructure

**Primary Storage:** File-based JSON storage (development/demo)  
**Production:** MongoDB Atlas (cloud database)

**Location:** Data centers in EU/UK regions (configurable)

### Security Measures

1. **Authentication:**
   - JWT-based authentication
   - HTTP-only cookies
   - Secure password hashing (bcrypt)
   - Minimum 32-character JWT secret

2. **Authorization:**
   - Role-based access control
   - Admin-only sensitive operations
   - Owner account protection

3. **Network Security:**
   - HTTPS encryption in production
   - Rate limiting on authentication endpoints
   - CSRF protection middleware

4. **Data Protection:**
   - Passwords never stored in plain text
   - Sensitive data excluded from exports
   - Audit logging for all admin actions

### Data Retention

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| Active user accounts | Indefinite | Account management |
| Deleted user data | 30 days | Recovery period |
| Audit logs | 2 years | Compliance and security |
| Photos (approved) | Indefinite | Platform content |
| Photos (rejected) | 90 days | Moderation review |
| Messages | Indefinite | User communication |
| Export files | Immediate deletion recommended | Admin discretion |

## User Rights Under GDPR

### Right to Access (Article 15)
Users can request access to their personal data:
- **Method:** Email admin@event-flow.co.uk
- **Response Time:** 30 days
- **Format:** JSON or CSV export
- **Scope:** All personal data held

### Right to Rectification (Article 16)
Users can correct inaccurate data:
- **Self-Service:** Update in Settings page
- **Admin Assistance:** Contact admin for profile updates
- **Verification:** Email verification for email changes

### Right to Erasure (Article 17)
Users can request data deletion ("right to be forgotten"):
- **Method:** Contact admin for account deletion
- **Admin Action:** DELETE /api/admin/users/:id
- **Scope:** All personal data and associated content
- **Exceptions:** Legal retention requirements, audit logs

### Right to Data Portability (Article 20)
Users can receive data in machine-readable format:
- **Method:** Request data export via admin
- **Format:** JSON (structured data)
- **Scope:** User-provided data and generated content

### Right to Object (Article 21)
Users can object to data processing:
- **Marketing:** Opt-out via marketing preferences
- **Profiling:** Disable in settings (if applicable)

### Right to Restrict Processing (Article 18)
Users can request processing restrictions:
- **Account Suspension:** Contact admin
- **Temporary Hold:** Admin can suspend account

### Rights Related to Automated Decision-Making (Article 22)
- **Current Status:** No fully automated decision-making
- **Smart Tagging:** Beta feature, admin-reviewed

## Data Processing Activities

### User Registration
- **Data Collected:** Name, email, password
- **Purpose:** Account creation
- **Retention:** Until account deletion
- **Third Parties:** None (email verification service if configured)

### Email Communications
- **Data Used:** Email address, name
- **Purpose:** Verification, notifications, marketing (with consent)
- **Service Providers:** AWS SES / SendGrid / SMTP server
- **Opt-Out:** Marketing preferences in settings

### Analytics (if enabled)
- **Data Collected:** Usage metrics, signups
- **Purpose:** Platform improvement
- **Anonymization:** No personal identifiers in basic metrics

### Photo Upload and Moderation
- **Data Collected:** Images, metadata, supplier association
- **Purpose:** Platform content, supplier portfolios
- **Retention:** See retention table
- **Processing:** Manual admin moderation

## Third-Party Data Processors

### Email Service Providers
- **AWS SES:** Email delivery (EU region configurable)
- **SendGrid:** Alternative email delivery
- **SMTP Server:** Custom server option

**Data Shared:** Email address, name, email content  
**Purpose:** Transactional and marketing emails  
**Safeguards:** Data Processing Agreement, GDPR-compliant providers

### Cloud Storage (if configured)
- **AWS S3:** Photo and file storage
- **Region:** Configurable (EU recommended)

### Database
- **MongoDB Atlas:** Production database (when configured)
- **Region:** Configurable
- **Encryption:** At rest and in transit

## Data Breach Procedures

### Detection
- Monitor audit logs for suspicious activity
- Review failed login attempts
- Track unauthorized access attempts

### Response Plan
1. **Immediate:** Identify and contain breach
2. **Assessment:** Determine scope and severity
3. **Notification:** 
   - Supervisory authority within 72 hours (if risk to users)
   - Affected users without undue delay (if high risk)
4. **Documentation:** Record breach details in audit log
5. **Mitigation:** Implement fixes and preventive measures

### Notification Template
```
Subject: Important Security Notice - EventFlow

Dear [User],

We are writing to inform you of a security incident that may have 
affected your personal data on EventFlow.

What happened: [Description]
Data affected: [Specific data types]
Actions taken: [Security measures]
What you should do: [User recommendations]

For more information or questions, contact: admin@event-flow.co.uk
```

## International Data Transfers

If data is transferred outside the EU/UK:
- **Mechanism:** Standard Contractual Clauses (SCCs)
- **Safeguards:** Encryption, access controls
- **Documentation:** Data transfer agreements

## Cookies and Tracking

### Essential Cookies
- **Authentication Token:** HTTP-only, secure
- **Purpose:** User session management
- **Expiry:** 7 days

### Optional Cookies
- **Theme Preference:** localStorage
- **UI Settings:** localStorage

**Cookie Consent:** Currently not required (essential cookies only)

## Children's Privacy

EventFlow is not intended for users under 16 years old.
- No knowingly collected data from children
- Age verification: None (implicit in service nature)
- Parental consent: Not applicable

## Admin Responsibilities

### Data Minimization
- Only collect necessary data
- Avoid excessive data retention
- Regular data cleanup

### Access Control
- Limit admin access to necessary personnel
- Review admin privileges quarterly
- Revoke access when no longer needed

### Audit Trail
- All admin actions logged
- Retain audit logs for 2 years
- Regular review of suspicious activity

### Data Exports
- Use exports only when necessary
- Securely store exported files
- Delete exports after use
- Never share exports via unencrypted channels

## User Consent Management

### Marketing Consent
- **Opt-In:** Required for marketing emails
- **Granular:** Separate from service emails
- **Withdrawal:** Easy opt-out in every email and settings

### Data Processing Consent
- **Terms of Service:** Accepted on registration
- **Privacy Policy:** Linked and accessible
- **Updates:** Users notified of policy changes

## Documentation and Records

### Records of Processing Activities (Article 30)
Maintained documentation includes:
- Categories of data processed
- Purposes of processing
- Data retention periods
- Security measures
- Third-party processors

### Data Protection Impact Assessments (DPIA)
Conducted for:
- New data processing activities
- Changes to existing processing
- High-risk processing activities

## Contact and Complaints

### Data Subject Requests
**Email:** admin@event-flow.co.uk  
**Response Time:** Within 30 days  
**Format:** Formal written response

### Complaints
Users can file complaints with:
- **EventFlow:** admin@event-flow.co.uk
- **Supervisory Authority:** ICO (UK) or relevant EU DPA

## Compliance Checklist

- [ ] JWT_SECRET configured (minimum 32 characters)
- [ ] HTTPS enabled in production
- [ ] Email verification configured
- [ ] Regular audit log reviews
- [ ] Admin access limited and documented
- [ ] Data retention policy enforced
- [ ] Backup procedures established
- [ ] Incident response plan tested
- [ ] Privacy policy published and accessible
- [ ] Terms of service accepted on registration
- [ ] Cookie notice displayed (if applicable)
- [ ] Data processing agreements with third parties
- [ ] GDPR training for admin users

## Updates and Maintenance

**Last Updated:** December 2024  
**Next Review:** June 2025  
**Version:** 1.0

This document should be reviewed and updated:
- Annually
- After significant platform changes
- Following regulatory updates
- After data breaches

## Appendix: Data Schema

### User Object
```json
{
  "id": "string (unique identifier)",
  "name": "string",
  "email": "string (unique)",
  "password": "string (bcrypt hash)",
  "role": "admin | supplier | customer",
  "verified": "boolean",
  "verifiedAt": "ISO 8601 timestamp",
  "marketingOptIn": "boolean",
  "createdAt": "ISO 8601 timestamp",
  "lastLoginAt": "ISO 8601 timestamp",
  "suspended": "boolean",
  "banned": "boolean"
}
```

### Supplier Object
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "contact": "object",
  "location": "object",
  "approved": "boolean",
  "verified": "boolean",
  "isPro": "boolean",
  "ownerUserId": "string (reference to user)",
  "createdAt": "ISO 8601 timestamp"
}
```

### Audit Log Entry
```json
{
  "id": "string",
  "adminId": "string",
  "adminEmail": "string",
  "action": "string",
  "targetType": "string",
  "targetId": "string",
  "details": "object",
  "timestamp": "ISO 8601 timestamp"
}
```
