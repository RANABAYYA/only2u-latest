# Fixing Bunny Stream 403 Error

## The Problem

You're getting a **403 Forbidden** error when trying to play videos:
```
ERROR  Response code: 403
Failed URL: https://vz-548767.b-cdn.net/d4328518-e8b5-49ae-b86c-c46cd6ee929e/playlist.m3u8
```

This happens because your Bunny Stream **Pull Zone** has security restrictions enabled that block direct video access from mobile apps.

## Quick Fix (Recommended for Mobile Apps)

### Option 1: Disable Token Authentication (Simplest)

1. Log into [Bunny.net Dashboard](https://dash.bunny.net/)
2. Go to **Stream** → **Pull Zones**
3. Click on your Pull Zone (vz-548767)
4. Go to **Security** tab
5. **Disable Token Authentication**
6. Save changes

Your videos will now play in the mobile app without 403 errors.

**Note:** This is safe for mobile apps since:
- Videos are already protected by your app's authentication
- Users need to log in to access video URLs
- Direct URL sharing is limited

### Option 2: Disable Referrer Restrictions

If Token Authentication is not enabled, check:

1. Go to **Stream** → **Pull Zones** → **Security**
2. Look for **Allowed Referrers** or **Hostname Restrictions**
3. Either:
   - Remove all referrer restrictions, OR
   - Add `*` to allow all referrers

Mobile apps don't send referrer headers, so referrer restrictions will block playback.

### Option 3: Enable CORS

1. Go to **Stream** → **Pull Zones** → **Security**
2. Under **CORS Settings**:
   - Enable **CORS**
   - Add `*` to **Allowed Origins** (or your specific domains)
   - Allow **GET** method
3. Save changes

## Advanced Fix (Token Authentication)

If you MUST keep Token Authentication enabled:

1. Get your **Token Authentication Key** from Bunny Dashboard
2. Add it to your `.env` file:
   ```bash
   EXPO_PUBLIC_BUNNY_TOKEN_KEY=your-token-key-here
   ```
3. The app will automatically sign URLs with the token

**Note:** This requires the `crypto-js` package to be installed:
```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

## Verification

After making changes:

1. **Clear app cache** and restart
2. **Test video playback** in Trending/Products screens
3. Check logs for:
   ```
   ✅ Bunny Stream HLS URL (ready for playback)
   ```

## Still Having Issues?

Check these common problems:

### 1. Geographic Restrictions
- Go to **Security** → **Geographic Restrictions**
- Make sure your user's country is not blocked

### 2. IP Restrictions
- Go to **Security** → **IP Restrictions**
- Remove any IP blocks that might affect your users

### 3. Rate Limiting
- Go to **Security** → **Rate Limiting**
- Ensure limits are reasonable for mobile app usage

### 4. Hotlink Protection
- Go to **Security** → **Hotlink Protection**
- Disable or configure to allow mobile apps

## Testing

Test with this video URL format:
```
https://vz-548767.b-cdn.net/{videoId}/playlist.m3u8
```

Expected result:
- ✅ Video plays smoothly
- ✅ No 403 errors in logs
- ✅ Adaptive streaming works

## Need Help?

If you're still experiencing 403 errors:

1. Check Bunny.net Dashboard → **Statistics** → **Error Logs**
2. Look for specific 403 error reasons
3. Contact Bunny.net support with your Pull Zone ID (548767)

---

**Recommended:** For mobile apps, disable Token Authentication and Referrer restrictions for the best user experience.

