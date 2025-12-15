# AWS SES Setup Guide for EventFlow

This guide explains how to configure AWS Simple Email Service (SES) for EventFlow's email delivery.

## Prerequisites

- An AWS account
- A verified domain (e.g., `event-flow.co.uk`)
- AWS IAM credentials with SES permissions

## Step 1: Verify Your Domain in AWS SES

1. Sign in to the [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **Amazon SES** (Simple Email Service)
3. Select your region (e.g., `eu-west-2` for London)
4. Go to **Verified identities** → **Create identity**
5. Choose **Domain** and enter your domain (e.g., `event-flow.co.uk`)
6. Click **Create identity**

## Step 2: Add DNS Records for Domain Verification

AWS SES will provide DNS records that you need to add to your domain:

### DKIM Records (for email authentication)

Add the CNAME records provided by AWS SES to your DNS:

```
Name: xxx._domainkey.event-flow.co.uk
Type: CNAME
Value: xxx.dkim.amazonses.com
```

You'll typically have 3 DKIM CNAME records to add.

### Verification Record

Add the TXT record for domain verification:

```
Name: _amazonses.event-flow.co.uk
Type: TXT
Value: [verification code provided by AWS]
```

**Note:** DNS propagation can take up to 72 hours, but usually completes within minutes to hours.

## Step 3: Set Up Custom MAIL FROM Domain (Recommended)

Using a custom MAIL FROM domain improves deliverability and SPF alignment.

1. In AWS SES, go to your verified domain
2. Click **Edit** next to "Custom MAIL FROM domain"
3. Enter subdomain: `mail.event-flow.co.uk`
4. Click **Save changes**

### Add Required DNS Records

#### MX Record

```
Name: mail.event-flow.co.uk
Type: MX
Priority: 10
Value: feedback-smtp.eu-west-2.amazonses.com
```

**Important:** Replace `eu-west-2` with your actual AWS region.

#### SPF Record

```
Name: mail.event-flow.co.uk
Type: TXT
Value: "v=spf1 include:amazonses.com ~all"
```

## Step 4: Request Production Access (Remove Sandbox Limitations)

By default, AWS SES accounts are in sandbox mode with limitations:

- Can only send to verified email addresses
- Maximum 200 emails per 24 hours
- Maximum 1 email per second

To send to any email address:

1. In AWS SES console, go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form with:
   - **Mail type:** Transactional
   - **Website URL:** Your EventFlow URL
   - **Use case description:**

     ```
     EventFlow is an event planning platform that sends transactional emails including:
     - Email verification for new user registrations
     - Password reset requests
     - Event notifications and updates
     - Supplier communication notifications

     All emails are opt-in and users can manage preferences in their account settings.
     ```

4. Submit the request

**Note:** Approval typically takes 24 hours.

## Step 5: Create IAM User with SES Permissions

1. Go to **IAM** (Identity and Access Management) in AWS Console
2. Click **Users** → **Create user**
3. Enter username: `eventflow-ses`
4. Click **Next**
5. Select **Attach policies directly**
6. Search for and attach: **AmazonSESFullAccess**
7. Click **Next** → **Create user**

### Generate Access Keys

1. Click on the newly created user
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Choose **Application running outside AWS**
5. Click **Next** → **Create access key**
6. **Important:** Copy both:
   - Access key ID
   - Secret access key (shown only once!)

## Step 6: Configure EventFlow

Add these variables to your `.env` file:

```env
# AWS SES Configuration
AWS_SES_REGION=eu-west-2
AWS_SES_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
FROM_EMAIL=no-reply@event-flow.co.uk

# Enable email sending
EMAIL_ENABLED=true
BASE_URL=https://your-domain.com
```

**Security Note:** Never commit `.env` to version control. It's already in `.gitignore`.

## Step 7: Verify Configuration

### Test Email Sending

1. Start your EventFlow server: `npm start`
2. Check the server logs for: `AWS SES configured for region: eu-west-2`
3. Register a new test account to trigger verification email
4. Check `/outbox` folder for saved email copy
5. Verify email was delivered to inbox

### Troubleshooting

**Email not sending:**

- Check AWS SES console → **Monitoring** for send statistics
- Verify IAM credentials have correct permissions
- Check CloudWatch Logs for SES errors
- Ensure domain verification is complete (green checkmark in SES)

**Emails going to spam:**

- Verify DKIM records are properly configured (should show green checkmarks)
- Set up Custom MAIL FROM domain
- Monitor bounce and complaint rates in SES console
- Consider adding DMARC record to your domain:
  ```
  Name: _dmarc.event-flow.co.uk
  Type: TXT
  Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@event-flow.co.uk"
  ```

## Email Limits and Monitoring

### Default Limits (Production Access)

- **Sending rate:** 14 emails/second (can be increased)
- **Daily quota:** 50,000 emails/day (can be increased)

### Request Limit Increases

1. Go to AWS SES Console → **Account dashboard**
2. Click on **Sending statistics**
3. Use **Request a sending quota increase** form

### Monitor Email Health

1. AWS SES Console → **Reputation metrics**
2. Keep bounce rate < 5%
3. Keep complaint rate < 0.1%
4. High rates may result in account suspension

## Cost

AWS SES Pricing (as of 2024):

- **First 62,000 emails/month:** $0.10 per 1,000 emails
- **Beyond 62,000:** $0.12 per 1,000 emails
- **Attachments:** $0.12 per GB

Example: 10,000 verification emails/month = **$1.00**

## Security Best Practices

1. **Rotate Access Keys:** Regularly rotate IAM access keys
2. **Use Least Privilege:** Create IAM policy with only required SES permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ses:SendEmail", "ses:SendRawEmail"],
         "Resource": "*"
       }
     ]
   }
   ```
3. **Monitor Usage:** Set up CloudWatch alarms for unusual sending patterns
4. **Enable MFA:** Enable multi-factor authentication on AWS account

## Additional Resources

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [Email Sending Best Practices](https://docs.aws.amazon.com/ses/latest/dg/sending-email-best-practices.html)
- [DKIM Setup Guide](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html)

## Support

For EventFlow-specific issues, contact the development team.
For AWS SES issues, refer to AWS Support or documentation.
