param(
  [string]$GatewayBaseUrl = "http://127.0.0.1:4000"
)

$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host ""
  Write-Host "==> $message"
}

function PostJson($url, $body, $headers = @{}) {
  $json = $body | ConvertTo-Json -Depth 8
  return Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body $json
}

function GetJson($url, $headers = @{}) {
  return Invoke-RestMethod -Method Get -Uri $url -Headers $headers
}

Step "Gateway health"
$health = GetJson "$GatewayBaseUrl/health"
Write-Host "Gateway OK: $($health.ok)"

Step "Customer login"
$login = PostJson "$GatewayBaseUrl/api/auth/login" @{
  identifier = "customer.demo@getcaramel.app"
  password = "dev-password"
  role = "customer"
}
$accessToken = $login.tokens.accessToken
$customerId = $login.profile.userId
$authHeaders = @{ Authorization = "Bearer $accessToken" }
Write-Host "Customer: $customerId"

Step "Vendor discovery"
$discovery = GetJson "$GatewayBaseUrl/api/orders/discovery" $authHeaders
if (-not $discovery.vendors -or $discovery.vendors.Count -eq 0) {
  throw "No vendors returned from discovery"
}
$vendor = $discovery.vendors[0]
$item = $vendor.menu[0]
Write-Host "Using vendor=$($vendor.vendorId), item=$($item.itemId)"

Step "Add item to cart"
$cart = PostJson "$GatewayBaseUrl/api/orders/cart/items" @{
  customerId = $customerId
  vendorId = $vendor.vendorId
  itemId = $item.itemId
  quantity = 1
} $authHeaders
Write-Host "Cart total cents: $($cart.totalCents)"

Step "Checkout with idempotency key"
$idemCheckout = "smoke-checkout-$([Guid]::NewGuid().ToString('N'))"
$checkoutHeaders = @{
  Authorization = "Bearer $accessToken"
  "x-idempotency-key" = $idemCheckout
}
$order = PostJson "$GatewayBaseUrl/api/orders/checkout" @{
  customerId = $customerId
  addressLine = "11 W 42nd St, New York, NY"
} $checkoutHeaders
Write-Host "Order created: $($order.orderId)"

Step "Create payment intent with idempotency key"
$idemIntent = "smoke-intent-$([Guid]::NewGuid().ToString('N'))"
$intentHeaders = @{
  Authorization = "Bearer $accessToken"
  "x-idempotency-key" = $idemIntent
}
$intent = PostJson "$GatewayBaseUrl/api/payments/intents" @{
  orderId = $order.orderId
  customerId = $customerId
  vendorId = $order.vendorId
  amountCents = [int]$order.totalCents
  method = "CARD"
} $intentHeaders
Write-Host "Payment intent: $($intent.paymentId), status=$($intent.status)"

if ($intent.status -ne "SUCCEEDED") {
  Step "Confirm payment with idempotency key"
  $idemConfirm = "smoke-confirm-$([Guid]::NewGuid().ToString('N'))"
  $confirmHeaders = @{
    Authorization = "Bearer $accessToken"
    "x-idempotency-key" = $idemConfirm
  }
  $confirmed = PostJson "$GatewayBaseUrl/api/payments/confirm" @{
    paymentId = $intent.paymentId
  } $confirmHeaders
  Write-Host "Payment status after confirm: $($confirmed.status)"
}

Step "Fetch customer orders"
$orders = GetJson "$GatewayBaseUrl/api/orders/customer/$customerId/paged?limit=5&offset=0" $authHeaders
Write-Host "Orders returned: $($orders.orders.Count)"

Step "Smoke flow completed"
Write-Host "PASS"
