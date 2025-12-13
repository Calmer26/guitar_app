#!/bin/bash

echo "🎸 Guitar4 Exercise Validation Suite"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED_FILES=()
PASSED_COUNT=0
FAILED_COUNT=0

# Step 1: XML Structure Validation
echo "Step 1: Validating XML structure..."
echo "-----------------------------------"

for file in examples/exercise/*.xml; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    
    # Run XML validator
    if node scripts/validate-exercise-xml.js "$file" > /dev/null 2>&1; then
      echo -e "${GREEN}✓${NC} $filename"
      ((PASSED_COUNT++))
    else
      echo -e "${RED}✗${NC} $filename"
      FAILED_FILES+=("$filename")
      ((FAILED_COUNT++))
      
      # Show errors
      node scripts/validate-exercise-xml.js "$file"
    fi
  fi
done

echo ""
echo "XML Validation: $PASSED_COUNT passed, $FAILED_COUNT failed"
echo ""

# Step 2: OSMD Rendering Test
if [ $FAILED_COUNT -eq 0 ]; then
  echo "Step 2: Testing OSMD rendering and playback..."
  echo "----------------------------------------------"
  
  # Start server in background
  npm start &
  SERVER_PID=$!
  
  # Wait for server to be ready
  sleep 3
  
  # Run Playwright tests
  npx playwright test src/tests/e2e/exercise-validation.test.js --reporter=line
  TEST_RESULT=$?
  
  # Kill server
  kill $SERVER_PID
  
  if [ $TEST_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}✅ All exercises passed E2E validation${NC}\n"
  else
    echo -e "\n${RED}❌ Some exercises failed E2E validation${NC}\n"
    exit 1
  fi
else
  echo -e "${RED}❌ Skipping E2E tests due to XML validation failures${NC}"
  echo ""
  echo "Failed files:"
  for file in "${FAILED_FILES[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

echo ""
echo "======================================"
echo "🎉 VALIDATION COMPLETE"
echo "======================================"
echo "Total exercises validated: $((PASSED_COUNT))"
