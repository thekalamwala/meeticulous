#!/bin/bash

# Vendor Onboarding Setup Verification Script
# Verifies all files are in place before running tests

echo "🔍 Vendor Onboarding Setup Verification"
echo "========================================"
echo ""

PASSED=0
FAILED=0

# Check database migration
echo "1️⃣  Checking database migration..."
if [ -f "server/migrations/v1.8_vendor_onboarding.sql" ]; then
    LINES=$(wc -l < server/migrations/v1.8_vendor_onboarding.sql)
    echo "   ✅ Migration file found ($LINES lines)"
    ((PASSED++))
else
    echo "   ❌ Migration file missing"
    ((FAILED++))
fi

# Check backend controller
echo ""
echo "2️⃣  Checking backend controller..."
if [ -f "server/controllers/vendorOnboardingController.js" ]; then
    LINES=$(wc -l < server/controllers/vendorOnboardingController.js)
    echo "   ✅ Controller found ($LINES lines)"
    ((PASSED++))
else
    echo "   ❌ Controller missing"
    ((FAILED++))
fi

# Check backend routes
echo ""
echo "3️⃣  Checking backend routes..."
if [ -f "server/routes/vendorOnboardingRoutes.js" ]; then
    LINES=$(wc -l < server/routes/vendorOnboardingRoutes.js)
    echo "   ✅ Routes file found ($LINES lines)"
    ((PASSED++))
else
    echo "   ❌ Routes file missing"
    ((FAILED++))
fi

# Check frontend components
echo ""
echo "4️⃣  Checking frontend components..."
COMPONENTS=0
for file in client/src/pages/onboarding/*.jsx; do
    if [ -f "$file" ]; then
        ((COMPONENTS++))
    fi
done
if [ $COMPONENTS -eq 12 ]; then
    echo "   ✅ All 12 components found (11 steps + ProgressBar)"
    ((PASSED++))
else
    echo "   ❌ Only $COMPONENTS components found (expected 12)"
    ((FAILED++))
fi

# Check API exports
echo ""
echo "5️⃣  Checking API exports..."
if grep -q "checkSlugAvailable" client/src/services/api.js; then
    echo "   ✅ API exports added to api.js"
    ((PASSED++))
else
    echo "   ❌ API exports missing"
    ((FAILED++))
fi

# Check App.jsx routes
echo ""
echo "6️⃣  Checking App.jsx routes..."
ROUTE_COUNT=$(grep -c "vendor-register" client/src/App.jsx)
if [ $ROUTE_COUNT -ge 11 ]; then
    echo "   ✅ All onboarding routes in App.jsx ($ROUTE_COUNT references)"
    ((PASSED++))
else
    echo "   ❌ Not all routes found (found $ROUTE_COUNT, expected 11+)"
    ((FAILED++))
fi

# Check ProtectedRoute updates
echo ""
echo "7️⃣  Checking ProtectedRoute updates..."
if grep -q "onboarding" client/src/components/common/ProtectedRoute.jsx; then
    echo "   ✅ Resume logic added to ProtectedRoute"
    ((PASSED++))
else
    echo "   ❌ Resume logic missing from ProtectedRoute"
    ((FAILED++))
fi

# Check server.js integration
echo ""
echo "8️⃣  Checking server.js integration..."
if grep -q "vendorOnboardingRoutes" server/server.js; then
    echo "   ✅ Routes registered in server.js"
    ((PASSED++))
else
    echo "   ❌ Routes not registered in server.js"
    ((FAILED++))
fi

# Check documentation
echo ""
echo "9️⃣  Checking documentation..."
DOCS=0
[ -f "docs/vendor-onboarding.md" ] && ((DOCS++))
[ -f "docs/vendor-onboarding-implementation-summary.md" ] && ((DOCS++))
[ -f "ONBOARDING_IMPLEMENTATION_CHECKLIST.md" ] && ((DOCS++))
if [ $DOCS -eq 3 ]; then
    echo "   ✅ All 3 documentation files found"
    ((PASSED++))
else
    echo "   ⚠️  Only $DOCS documentation files found (expected 3)"
fi

# Summary
echo ""
echo "========================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo "✅ Setup verification PASSED!"
    echo ""
    echo "Next steps:"
    echo "1. Apply migration in Supabase SQL Editor:"
    echo "   - Copy contents of: server/migrations/v1.8_vendor_onboarding.sql"
    echo "   - Run in: Supabase → SQL Editor"
    echo ""
    echo "2. Start servers:"
    echo "   - Terminal 1: cd server && npm run dev"
    echo "   - Terminal 2: cd client && npm run dev"
    echo ""
    echo "3. Test onboarding:"
    echo "   - Visit: http://localhost:5173/vendor-register"
    echo "   - Follow: ONBOARDING_IMPLEMENTATION_CHECKLIST.md"
    echo ""
    exit 0
else
    echo "❌ Setup verification FAILED!"
    echo "Please check the missing items above."
    exit 1
fi
