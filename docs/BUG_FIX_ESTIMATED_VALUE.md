# Bug Fix: TypeError on Affiliate Dashboard - estimatedValue.toFixed()

## 🐛 Problem Summary

**Error Reported:**
```
Uncaught TypeError: Cannot read properties of undefined (reading 'toFixed')
    at page-04cca3bed7767226.js:1:6608
```

**User Report:**
> "Once the affiliate user reaches the dashboard, when submitting a lead, it shows an affiliate user like this. Currently, the data is being admitted but it is showing something like this TypeError..."

## 🔍 Root Cause Analysis

### The Problem

The affiliate dashboard was trying to display referral estimated values using:
```typescript
${ref.estimatedValue.toFixed(2)}
```

But `ref.estimatedValue` was **undefined**, causing the error when calling `.toFixed()` on undefined.

### Why It Was Undefined

1. **Database Storage:** The `estimated_value` is stored in the `metadata` JSON field of the `Referral` model
2. **API Response:** The API was returning raw Prisma data with `metadata` as a JSON object
3. **Frontend Expectation:** The frontend TypeScript interface expected `estimatedValue` as a direct property
4. **Mismatch:** The API never mapped `metadata.estimated_value` to `estimatedValue`

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│              BEFORE FIX (BROKEN)                             │
└─────────────────────────────────────────────────────────────┘

Affiliate submits lead
         ↓
POST /api/affiliate/referrals
         ↓
Stores in database:
{
  leadName: "John Doe",
  leadEmail: "john@example.com",
  metadata: {
    estimated_value: 5000,  ← Stored here
    company: "ACME Corp"
  }
}
         ↓
GET /api/affiliate/profile (or /api/affiliate/referrals)
         ↓
Returns raw Prisma data:
{
  id: "abc123",
  leadName: "John Doe",
  metadata: { estimated_value: 5000 }
  // NO estimatedValue property! ❌
}
         ↓
Frontend tries to access:
ref.estimatedValue.toFixed(2)
         ↓
❌ ERROR: Cannot read properties of undefined (reading 'toFixed')


┌─────────────────────────────────────────────────────────────┐
│              AFTER FIX (WORKING)                             │
└─────────────────────────────────────────────────────────────┘

Affiliate submits lead
         ↓
POST /api/affiliate/referrals
         ↓
Stores in database:
{
  metadata: {
    estimated_value: 5000,
    company: "ACME Corp"
  }
}
         ↓
GET /api/affiliate/profile (or /api/affiliate/referrals)
         ↓
Maps the data:
const mappedReferrals = referrals.map(ref => {
  const metadata = ref.metadata as any;
  return {
    ...ref,
    estimatedValue: metadata?.estimated_value || 0,  ✅
    company: metadata?.company || '',
  };
});
         ↓
Returns mapped data:
{
  id: "abc123",
  leadName: "John Doe",
  estimatedValue: 5000,  ✅ Direct property
  company: "ACME Corp"
}
         ↓
Frontend displays:
(ref.estimatedValue || 0).toFixed(2)  ✅ With fallback
         ↓
✅ SUCCESS: Shows "$5000.00"
```

---

## ✅ The Fix

### 1. Frontend Safe Access (src/app/affiliate/page.tsx)

**Lines 195 & 300 - Added fallback to prevent error:**

```diff
// Dashboard Recent Referrals Table (Line ~195)
- ${ref.estimatedValue.toFixed(2)}
+ ${(ref.estimatedValue || 0).toFixed(2)}

// Referrals Page Table (Line ~300)
- ${ref.estimatedValue.toFixed(2)}
+ ${(ref.estimatedValue || 0).toFixed(2)}
```

**Why This Helps:**
- If `estimatedValue` is undefined, use `0` instead
- Prevents the TypeError from crashing the page
- Shows `$0.00` for referrals without estimated values

### 2. API Data Mapping (src/app/api/affiliate/profile/route.ts)

**Added mapping to extract estimatedValue from metadata:**

```typescript
// Map referrals to include estimatedValue from metadata
const mappedReferrals = referrals.map(ref => {
  const metadata = ref.metadata as any;
  return {
    ...ref,
    estimatedValue: metadata?.estimated_value || 0,
    company: metadata?.company || '',
  };
});

return NextResponse.json({
  success: true,
  referrals: mappedReferrals,  // ✅ Send mapped data
  // ... other fields
});
```

### 3. Referrals API Mapping (src/app/api/affiliate/referrals/route.ts)

**Added same mapping to GET endpoint:**

```typescript
const referrals = await prisma.referral.findMany({
  where: { affiliateId: user.affiliate.id },
  orderBy: { createdAt: 'desc' }
});

// Map referrals to include estimatedValue from metadata
const mappedReferrals = referrals.map(ref => {
  const metadata = ref.metadata as any;
  return {
    ...ref,
    estimatedValue: metadata?.estimated_value || 0,
    company: metadata?.company || '',
  };
});

return NextResponse.json({
  success: true,
  referrals: mappedReferrals,  // ✅ Send mapped data
});
```

---

## 📋 Files Changed

| File | Changes | Description |
|------|---------|-------------|
| `src/app/affiliate/page.tsx` | Lines 195, 300 | Added `|| 0` fallback to prevent toFixed() error |
| `src/app/api/affiliate/profile/route.ts` | Added mapping logic | Extract estimatedValue from metadata JSON |
| `src/app/api/affiliate/referrals/route.ts` | Added mapping logic | Extract estimatedValue from metadata JSON |

---

## 🧪 Testing Steps

### 1. Test Dashboard Display
1. Login as affiliate user
2. Navigate to Dashboard page
3. **Expected:** Recent referrals table shows estimated values without errors ✅
4. **Expected:** If no estimated value, shows `$0.00` ✅

### 2. Test Referrals Page
1. Click "Referrals" in sidebar
2. View all referrals
3. **Expected:** Estimated values display correctly ✅
4. **Expected:** No TypeError in console ✅

### 3. Test Submit New Lead
1. Click "Submit a Lead" button
2. Fill in lead details:
   - Name: Test Lead
   - Email: test@example.com
   - Company: Test Corp
   - Estimated Value: 5000
3. Submit the form
4. **Expected:** Lead appears in table with `$5000.00` ✅
5. **Expected:** No console errors ✅

### 4. Test Old Referrals (Without Estimated Value)
1. Check referrals created before this fix
2. **Expected:** Shows `$0.00` instead of crashing ✅
3. **Expected:** Rest of the data displays correctly ✅

---

## 🎯 Before vs After

### Before Fix
```
User submits lead → Dashboard shows referrals
                    ↓
                 ❌ TypeError: Cannot read properties of undefined
                 ❌ Page breaks
                 ❌ User sees error screen
```

### After Fix
```
User submits lead → Dashboard shows referrals
                    ↓
                 ✅ Shows $5000.00 (if value exists)
                 ✅ Shows $0.00 (if value missing)
                 ✅ No errors
                 ✅ Page works perfectly
```

---

## 🔧 Technical Details

### TypeScript Interface
```typescript
interface Referral {
  id: string;
  leadName: string;
  leadEmail: string;
  company?: string;
  estimatedValue: number;  // Expected as direct property
  status: string;
  createdAt: string;
  amountPaid?: number;
  commission?: number;
}
```

### Database Schema (Prisma)
```prisma
model Referral {
  id          String   @id @default(cuid())
  affiliateId String
  leadName    String
  leadEmail   String
  status      ReferralStatus
  metadata    Json     @default("{}")  // Contains estimated_value
  createdAt   DateTime @default(now())
  // ... other fields
}
```

### Metadata Structure
```json
{
  "estimated_value": 5000,
  "company": "ACME Corp",
  "notes": "Interested in enterprise plan",
  "source": "manual"
}
```

---

## 🚀 Deployment

### No Database Migration Needed
- This is a data mapping fix only
- No schema changes required
- Existing data remains unchanged

### Deploy Steps
```powershell
# Commit the changes
git add .
git commit -m "fix: Add estimatedValue mapping from metadata and safe toFixed() calls"

# Push to repository
git push origin main

# Restart application (if needed)
npm run build
npm run start
```

---

## 🐛 Related Issues Fixed

1. ✅ **TypeError on Dashboard:** Can't read 'toFixed' of undefined
2. ✅ **Missing estimated values:** Now properly extracted from metadata
3. ✅ **Missing company names:** Also extracted from metadata
4. ✅ **Crash when viewing referrals:** Page now handles missing data gracefully

---

## 💡 Prevention Tips

### For Future Development

1. **Always use optional chaining:**
   ```typescript
   // Bad
   value.toFixed(2)
   
   // Good
   (value || 0).toFixed(2)
   ```

2. **Map API responses to match frontend interfaces:**
   ```typescript
   // Don't return raw Prisma data
   return { referrals };
   
   // Do map to expected structure
   return { 
     referrals: referrals.map(r => ({
       ...r,
       estimatedValue: r.metadata.estimated_value || 0
     }))
   };
   ```

3. **Use TypeScript strictly:**
   ```typescript
   // Define exact types
   interface Referral {
     estimatedValue: number;  // Not optional if always needed
   }
   ```

4. **Add error boundaries:**
   ```typescript
   // Catch rendering errors before they crash the page
   try {
     return <ReferralTable referrals={referrals} />;
   } catch (error) {
     return <ErrorMessage />;
   }
   ```

---

## 📊 Impact

- **Severity:** HIGH (Crashed affiliate dashboard)
- **Users Affected:** All affiliates viewing their dashboard
- **Data Loss:** None (data was stored correctly)
- **Fix Complexity:** LOW (Simple mapping + fallback)
- **Testing Required:** MEDIUM (Test multiple scenarios)

---

**Fixed By:** GitHub Copilot  
**Date:** 2025-10-13  
**Status:** ✅ Production-ready  
**Risk Level:** LOW (Safe fallback + proper mapping)
