import type { ArchitectManifest, TargetLanguage } from '../types';

export interface BlueprintFileEntry {
  filePath: string;
  role: string;
  moduleOrPackage: string;
  expectedSymbols: string[];
  dependencies: string[];
  btContract: string;
  btDraft: string; // Must be < 40 o200k tokens
  verboseDraft: string;
  pureCode: string;
  faultyPollutedCode?: string; // Used when injectFaultDrill=true
}

export interface ShowcaseBlueprint {
  id: string;
  language: TargetLanguage;
  titleZh: string;
  badgeZh: string;
  defaultPromptZh: string;
  btPrd: string; // Must be < 120 o200k tokens
  verbosePrd: string;
  btArch: string;
  verboseArch: string;
  archSummaryZh: string;
  files: BlueprintFileEntry[];
}

export const SHOWCASE_BLUEPRINTS: Record<TargetLanguage, ShowcaseBlueprint> = {
  java: {
    id: 'java-ecommerce-inventory',
    language: 'java',
    titleZh: '高并发电商防超卖库存与幂等订单服务',
    badgeZh: '☕ Java 21 · 零依赖并发内核',
    defaultPromptZh:
      '开发一套高并发电商订单与防超卖库存核心服务（Java）：支持按 SKU 细粒度加锁原子预扣库存、幂等键防重下单、订单支付状态流转、取消订单自动回滚库存，并附带 50 线程并发抢购防超卖自测程序。',
    btPrd:
      '#PRD[dom:电商防超卖订单内核 | lang:java | goals:SKU细粒度锁预扣+幂等下单+支付流转+取消回滚 | inv:!Guard(stock>=0) & !Guard(idemKey_1to1) | slo:50线程抢购0超卖]',
    verbosePrd: `Hello Architect and Engineering Team! Thank you for sharing the project requirements. Let me carefully analyze the user's business goals and draft a comprehensive Product Requirements Document (PRD) for our Java E-Commerce Order & Anti-Oversell Inventory Service.

1. Project Background & Executive Summary:
In high-concurrency flash-sale scenarios, naive check-then-act inventory logic causes severe overselling and duplicate orders when users click submit repeatedly. Therefore, we need a thread-safe domain service written in standard Java.

2. Functional Requirements:
- Domain Model (Order): Represent an e-commerce order with immutable identity, userId, SKU code, quantity, total price in cents, creation timestamp, and explicit lifecycle statuses (CREATED, PAID, CANCELLED).
- Anti-Oversell Inventory Service: Manage per-SKU stock balances using thread-safe concurrency primitives so concurrent deductions never drop stock below zero. Throw a dedicated InsufficientStockException whenever requested stock exceeds availability, and support atomic stock release upon order cancellation.
- Idempotent Order Service: Accept an idempotencyKey during order creation so duplicate network retries return the exact existing Order without deducting inventory twice. Support paying CREATED orders and cancelling unpaid orders with automatic stock rollback.
- Concurrent Verification Suite: Include a standalone runnable MainTest class that validates normal flows, idempotency, cancellation rollback, and a 50-thread concurrent flash-sale stress test against 10 items in stock.`,
    btArch: [
      '#ARCH[proj:shop-core | pkg:com.babeltele.shop',
      '  @Order.java ⊢ Cls:Order,Enum:Status Fn:markPaid,markCancelled',
      '  @InventoryService.java ⊢ Cls:InventoryService,InsufficientStockException Fn:setStock,reserveStock,releaseStock,getAvailableStock',
      '  @OrderService.java ⊢ Dep:Order+Inventory Fn:createOrder,payOrder,cancelOrder,getTotalConfirmedRevenueCents',
      '  @MainTest.java ⊢ Dep:all Fn:main',
      ']',
    ].join('\n'),
    verboseArch: `Great PRD, PM-Spec! I have reviewed all functional and concurrency invariants and designed a clean 4-file modular Java architecture under the package \`com.babeltele.shop\`. Let me walk everyone through each file's responsibility and exact interface contract in detail:

1. \`src/com/babeltele/shop/Order.java\`:
   - Houses the \`Order\` entity class and nested \`Order.Status\` enum (\`CREATED\`, \`PAID\`, \`CANCELLED\`).
   - Provides synchronized state transitions \`markPaid()\` and \`markCancelled()\` with illegal-state guards so cancelled orders can never be paid and paid orders cannot be double-cancelled.

2. \`src/com/babeltele/shop/InventoryService.java\`:
   - Implements fine-grained per-SKU striped locking via \`ConcurrentHashMap<String, ReentrantLock>\` paired with \`AtomicInteger\` stock counters.
   - Exposes \`setStock(String sku, int qty)\`, \`reserveStock(String sku, int qty)\`, \`releaseStock(String sku, int qty)\`, \`getAvailableStock(String sku)\`, and defines \`public static class InsufficientStockException extends RuntimeException\`.

3. \`src/com/babeltele/shop/OrderService.java\`:
   - Orchestrates \`InventoryService\` and maintains thread-safe maps for \`ordersById\` and \`idempotencyRecords\`.
   - Exposes \`createOrder(String idempotencyKey, String userId, String sku, int quantity, long unitPriceCents)\`, \`payOrder(String orderId)\`, \`cancelOrder(String orderId)\`, and \`getTotalConfirmedRevenueCents()\`.

4. \`src/com/babeltele/shop/MainTest.java\`:
   - Standalone verification runner with \`public static void main(String[] args)\` executing 4 rigorous assertions including a 50-thread \`ExecutorService\` + \`CountDownLatch\` flash-sale race test.`,
    archSummaryZh: 'Java 四层并发防超卖架构：Order 领域模型 → InventoryService 细粒度分段锁库存 → OrderService 幂等编排 → MainTest 50线程并发压测。',
    files: [
      {
        filePath: 'src/com/babeltele/shop/Order.java',
        role: '订单聚合根与状态机守卫',
        moduleOrPackage: 'com.babeltele.shop',
        expectedSymbols: ['Order', 'Status', 'markPaid', 'markCancelled'],
        dependencies: [],
        btContract: '@FILE:src/com/babeltele/shop/Order.java ⊢ Cls:Order,Enum:Status Fn:markPaid(),markCancelled()',
        btDraft: '#DRAFT[@Order.java ⊢ fields+sync(PAID|CANCELLED) ⊥ pure:java]',
        verboseDraft:
          'Let me start by implementing Order.java in package com.babeltele.shop. I will validate constructor arguments so quantity is positive and unitPriceCents is non-negative, define the nested Status enum with CREATED, PAID, and CANCELLED states, and synchronize markPaid() and markCancelled() so concurrent state transitions remain strictly consistent.',
        pureCode: `package com.babeltele.shop;

import java.time.Instant;
import java.util.Objects;

public final class Order {

    public enum Status {
        CREATED,
        PAID,
        CANCELLED
    }

    private final String orderId;
    private final String idempotencyKey;
    private final String userId;
    private final String sku;
    private final int quantity;
    private final long totalCents;
    private final Instant createdAt;
    private Status status;

    public Order(
            String orderId,
            String idempotencyKey,
            String userId,
            String sku,
            int quantity,
            long unitPriceCents) {
        this.orderId = Objects.requireNonNull(orderId, "orderId must not be null");
        this.idempotencyKey = Objects.requireNonNull(idempotencyKey, "idempotencyKey must not be null");
        this.userId = Objects.requireNonNull(userId, "userId must not be null");
        this.sku = Objects.requireNonNull(sku, "sku must not be null");
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be > 0");
        }
        if (unitPriceCents < 0) {
            throw new IllegalArgumentException("unitPriceCents must be >= 0");
        }
        this.quantity = quantity;
        this.totalCents = Math.multiplyExact(unitPriceCents, (long) quantity);
        this.createdAt = Instant.now();
        this.status = Status.CREATED;
    }

    public String getOrderId() {
        return orderId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getUserId() {
        return userId;
    }

    public String getSku() {
        return sku;
    }

    public int getQuantity() {
        return quantity;
    }

    public long getTotalCents() {
        return totalCents;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public synchronized Status getStatus() {
        return status;
    }

    public synchronized void markPaid() {
        if (status == Status.CANCELLED) {
            throw new IllegalStateException("Cannot pay a cancelled order: " + orderId);
        }
        this.status = Status.PAID;
    }

    public synchronized boolean markCancelled() {
        if (status == Status.PAID) {
            throw new IllegalStateException("Cannot cancel an already paid order: " + orderId);
        }
        if (status == Status.CANCELLED) {
            return false;
        }
        this.status = Status.CANCELLED;
        return true;
    }
}
`,
      },
      {
        filePath: 'src/com/babeltele/shop/InventoryService.java',
        role: 'SKU 分段锁原子防超卖库存服务',
        moduleOrPackage: 'com.babeltele.shop',
        expectedSymbols: [
          'InventoryService',
          'InsufficientStockException',
          'setStock',
          'reserveStock',
          'releaseStock',
          'getAvailableStock',
        ],
        dependencies: [],
        btContract:
          '@FILE:src/com/babeltele/shop/InventoryService.java ⊢ Cls:InventoryService,InsufficientStockException Fn:setStock,reserveStock,releaseStock,getAvailableStock',
        btDraft: '#DRAFT[@InventoryService.java ⊢ Map<SKU,ReentrantLock>+AtomicInteger ⊥ pure:java]',
        verboseDraft:
          'Next, I will implement InventoryService.java. To guarantee zero overselling under intense multi-threaded contention without blocking unrelated SKUs, I will maintain a ConcurrentHashMap of ReentrantLocks keyed by SKU alongside AtomicInteger stock counters, and raise InsufficientStockException whenever available stock is lower than the requested quantity.',
        pureCode: `package com.babeltele.shop;

import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

public class InventoryService {

    public static class InsufficientStockException extends RuntimeException {
        private final String sku;
        private final int requested;
        private final int available;

        public InsufficientStockException(String sku, int requested, int available) {
            super("Insufficient stock for SKU " + sku + ": requested=" + requested + ", available=" + available);
            this.sku = sku;
            this.requested = requested;
            this.available = available;
        }

        public String getSku() {
            return sku;
        }

        public int getRequested() {
            return requested;
        }

        public int getAvailable() {
            return available;
        }
    }

    private final ConcurrentHashMap<String, AtomicInteger> stockLedger = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> skuLocks = new ConcurrentHashMap<>();

    private ReentrantLock lockForSku(String sku) {
        return skuLocks.computeIfAbsent(sku, k -> new ReentrantLock());
    }

    public void setStock(String sku, int initialQuantity) {
        Objects.requireNonNull(sku, "sku must not be null");
        if (initialQuantity < 0) {
            throw new IllegalArgumentException("initialQuantity must be >= 0");
        }
        ReentrantLock lock = lockForSku(sku);
        lock.lock();
        try {
            stockLedger.put(sku, new AtomicInteger(initialQuantity));
        } finally {
            lock.unlock();
        }
    }

    public void reserveStock(String sku, int quantity) {
        Objects.requireNonNull(sku, "sku must not be null");
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be > 0");
        }
        ReentrantLock lock = lockForSku(sku);
        lock.lock();
        try {
            AtomicInteger counter = stockLedger.get(sku);
            int available = counter == null ? 0 : counter.get();
            if (available < quantity) {
                throw new InsufficientStockException(sku, quantity, available);
            }
            counter.set(available - quantity);
        } finally {
            lock.unlock();
        }
    }

    public void releaseStock(String sku, int quantity) {
        Objects.requireNonNull(sku, "sku must not be null");
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be > 0");
        }
        ReentrantLock lock = lockForSku(sku);
        lock.lock();
        try {
            stockLedger.computeIfAbsent(sku, k -> new AtomicInteger(0)).addAndGet(quantity);
        } finally {
            lock.unlock();
        }
    }

    public int getAvailableStock(String sku) {
        AtomicInteger counter = stockLedger.get(sku);
        return counter == null ? 0 : counter.get();
    }
}
`,
      },
      {
        filePath: 'src/com/babeltele/shop/OrderService.java',
        role: '幂等下单、支付确认与取消回滚编排服务',
        moduleOrPackage: 'com.babeltele.shop',
        expectedSymbols: [
          'OrderService',
          'createOrder',
          'payOrder',
          'cancelOrder',
          'getTotalConfirmedRevenueCents',
        ],
        dependencies: ['src/com/babeltele/shop/Order.java', 'src/com/babeltele/shop/InventoryService.java'],
        btContract:
          '@FILE:src/com/babeltele/shop/OrderService.java ⊢ Dep:Order+InventoryService Fn:createOrder,payOrder,cancelOrder,getTotalConfirmedRevenueCents',
        btDraft: '#DRAFT[@OrderService.java ⇐ §SMFT ⊢ idemLock+reserve ⊥ pure:java]',
        verboseDraft:
          'Now I will write OrderService.java, referencing the full Order and InventoryService classes we created earlier. I will guard idempotency keys using per-key locks so concurrent duplicate submissions with the same idempotencyKey only reserve inventory once, and ensure cancelOrder atomically transitions status to CANCELLED before calling releaseStock.',
        faultyPollutedCode: `package com.babeltele.shop;

// #DRAFT[leaked_control_header]
import java.util.UUID;

public class OrderService {
    private final InventoryService inventoryService;

    public OrderService(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public Order createOrder(String idempotencyKey, String userId, String sku, int quantity, long unitPriceCents) {
        if (quantity <= 0) ⇒ throw new IllegalArgumentException("bad qty");
        inventoryService.reserveStock(sku, quantity);
        return new Order(UUID.randomUUID().toString(), idempotencyKey, userId, sku, quantity, unitPriceCents);
    }
}
`,
        pureCode: `package com.babeltele.shop;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

public class OrderService {

    private final InventoryService inventoryService;
    private final ConcurrentHashMap<String, Order> ordersById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Order> ordersByIdemKey = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> idemLocks = new ConcurrentHashMap<>();

    public OrderService(InventoryService inventoryService) {
        this.inventoryService = Objects.requireNonNull(inventoryService, "inventoryService must not be null");
    }

    public Order createOrder(
            String idempotencyKey,
            String userId,
            String sku,
            int quantity,
            long unitPriceCents) {
        Objects.requireNonNull(idempotencyKey, "idempotencyKey must not be null");
        Order existingFast = ordersByIdemKey.get(idempotencyKey);
        if (existingFast != null) {
            return existingFast;
        }

        ReentrantLock keyLock = idemLocks.computeIfAbsent(idempotencyKey, k -> new ReentrantLock());
        keyLock.lock();
        try {
            Order existing = ordersByIdemKey.get(idempotencyKey);
            if (existing != null) {
                return existing;
            }
            inventoryService.reserveStock(sku, quantity);
            String orderId = "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            Order created = new Order(orderId, idempotencyKey, userId, sku, quantity, unitPriceCents);
            ordersById.put(orderId, created);
            ordersByIdemKey.put(idempotencyKey, created);
            return created;
        } finally {
            keyLock.unlock();
        }
    }

    public Order payOrder(String orderId) {
        Order order = getOrder(orderId);
        order.markPaid();
        return order;
    }

    public Order cancelOrder(String orderId) {
        Order order = getOrder(orderId);
        boolean transitioned = order.markCancelled();
        if (transitioned) {
            inventoryService.releaseStock(order.getSku(), order.getQuantity());
        }
        return order;
    }

    public Order getOrder(String orderId) {
        Order order = ordersById.get(orderId);
        if (order == null) {
            throw new NoSuchElementException("Order not found: " + orderId);
        }
        return order;
    }

    public long getTotalConfirmedRevenueCents() {
        long sum = 0L;
        for (Order order : ordersById.values()) {
            if (order.getStatus() == Order.Status.PAID) {
                sum += order.getTotalCents();
            }
        }
        return sum;
    }
}
`,
      },
      {
        filePath: 'src/com/babeltele/shop/MainTest.java',
        role: '50线程抢购压测与业务闭环自检套件',
        moduleOrPackage: 'com.babeltele.shop',
        expectedSymbols: ['MainTest', 'main'],
        dependencies: [
          'src/com/babeltele/shop/Order.java',
          'src/com/babeltele/shop/InventoryService.java',
          'src/com/babeltele/shop/OrderService.java',
        ],
        btContract: '@FILE:src/com/babeltele/shop/MainTest.java ⊢ Cls:MainTest Fn:main(String[])',
        btDraft: '#DRAFT[@MainTest.java ⇐ §SMFT ⊢ 4_tests+50t_race ⊥ pure:java]',
        verboseDraft:
          'Finally, I will implement MainTest.java to thoroughly test all components end-to-end: order creation and payment revenue calculation, duplicate idempotencyKey protection, stock restoration upon cancellation, and a 50-thread CountDownLatch race for 10 units of flash-sale inventory.',
        pureCode: `package com.babeltele.shop;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class MainTest {

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError("Verification failed: " + message);
        }
    }

    public static void main(String[] args) throws InterruptedException {
        InventoryService inventory = new InventoryService();
        OrderService orderService = new OrderService(inventory);

        // 1. Standard order & payment flow
        inventory.setStock("SKU-GPU-5090", 5);
        Order o1 = orderService.createOrder("idem-001", "user-alice", "SKU-GPU-5090", 2, 1599900L);
        check(inventory.getAvailableStock("SKU-GPU-5090") == 3, "Stock should be 3 after reserving 2");
        orderService.payOrder(o1.getOrderId());
        check(o1.getStatus() == Order.Status.PAID, "Order status should be PAID");
        check(orderService.getTotalConfirmedRevenueCents() == 3199800L, "Confirmed revenue mismatch");

        // 2. Idempotency deduplication check
        Order o1Dup = orderService.createOrder("idem-001", "user-alice", "SKU-GPU-5090", 2, 1599900L);
        check(o1.getOrderId().equals(o1Dup.getOrderId()), "Duplicate idempotency key must return same Order");
        check(inventory.getAvailableStock("SKU-GPU-5090") == 3, "Duplicate request must not deduct stock again");

        // 3. Cancellation stock rollback check
        Order o2 = orderService.createOrder("idem-002", "user-bob", "SKU-GPU-5090", 2, 1599900L);
        check(inventory.getAvailableStock("SKU-GPU-5090") == 1, "Stock should drop to 1");
        orderService.cancelOrder(o2.getOrderId());
        check(o2.getStatus() == Order.Status.CANCELLED, "Order o2 should be CANCELLED");
        check(inventory.getAvailableStock("SKU-GPU-5090") == 3, "Cancelled order must restore 2 units");

        // 4. 50-thread flash-sale anti-oversell stress test (10 units available)
        final String flashSku = "SKU-LIMITED-EDITION";
        inventory.setStock(flashSku, 10);
        final int threads = 50;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch startGun = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            final int idx = i;
            pool.submit(() -> {
                ready.countDown();
                try {
                    startGun.await();
                    orderService.createOrder("flash-key-" + idx, "buyer-" + idx, flashSku, 1, 9900L);
                    successCount.incrementAndGet();
                } catch (InventoryService.InsufficientStockException ex) {
                    rejectedCount.incrementAndGet();
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }

        ready.await();
        startGun.countDown();
        check(done.await(10, TimeUnit.SECONDS), "Concurrent workers timed out");
        pool.shutdownNow();

        check(successCount.get() == 10, "Expected exact 10 successful orders, got " + successCount.get());
        check(rejectedCount.get() == 40, "Expected exact 40 clean rejections, got " + rejectedCount.get());
        check(inventory.getAvailableStock(flashSku) == 0, "Final stock must be strictly 0");

        System.out.println(
                "[PASS] Java Anti-Oversell Suite: 4/4 checks green (50-thread race => sold="
                        + successCount.get()
                        + ", rejected="
                        + rejectedCount.get()
                        + ", remaining="
                        + inventory.getAvailableStock(flashSku)
                        + ")");
    }
}
`,
      },
    ],
  },

  typescript: {
    id: 'ts-jwt-rate-task-queue',
    language: 'typescript',
    titleZh: 'JWT 鉴权与令牌桶限流优先级异步任务队列',
    badgeZh: '🔷 TypeScript · 零依赖微服务内核',
    defaultPromptZh:
      '使用 TypeScript 构建一套零外部依赖的微服务任务调度内核：包含 HMAC-SHA256 JWT 签发与防篡改校验、多租户令牌桶突发限流器、带优先级排序与死信队列 (DLQ) 重试机制的异步任务队列，以及自动化自检测试。',
    btPrd:
      '#PRD[dom:JWT限流异步任务队列 | lang:typescript | goals:HMAC-JWT鉴权+多租户令牌桶限流+优先级队列+重试死信DLQ | inv:!Guard(timingSafe_sig) & !Guard(dlq_after_maxRetry) | slo:4项集成自测全绿]',
    verbosePrd: `Hello Engineering Team! Thank you for the opportunity to specify this TypeScript backend microservice component. Let me write out a detailed Product Requirements Document (PRD) covering every security, rate-limiting, and asynchronous task processing requirement.

1. Overview & Motivation:
Modern multi-tenant API gateways and worker systems must authenticate callers using signed tokens, protect downstream resources from noisy-neighbor traffic spikes via per-tenant rate limiting, and execute background jobs reliably according to business priority while isolating poison messages in a Dead-Letter Queue (DLQ).

2. Detailed Functional Requirements:
- Cryptographic JWT Module (jwtAuth.ts): Sign and verify stateless HS256 JSON Web Tokens using Node's native \`node:crypto\` module with constant-time signature verification (\`crypto.timingSafeEqual\`) and expiration enforcement.
- Multi-Tenant Token Bucket Rate Limiter (rateLimiter.ts): Maintain per-tenant token buckets supporting configurable burst capacity and steady refill rate per second, returning accurate \`retryAfterMs\` hints when throttled.
- Priority Task Queue with DLQ (taskQueue.ts): Authenticate incoming task submissions with JWTs, enforce per-tenant rate limits, schedule tasks in descending priority order, and automatically retry failed executions up to \`maxAttempts\` before moving poison tasks into the Dead-Letter Queue.
- Automated Verification Suite (main.test.ts): Verify JWT tamper detection, rate-limit throttling & refill recovery, priority ordering, and DLQ routing.`,
    btArch: [
      '#ARCH[proj:jwt-queue | mod:src/*',
      '  @jwtAuth.ts ⊢ Ifc:JwtPayload,Cls:JwtAuthError Fn:signJwt,verifyJwt',
      '  @rateLimiter.ts ⊢ Ifc:RateLimitDecision,Cls:TokenBucketRateLimiter Fn:consume',
      '  @taskQueue.ts ⊢ Dep:jwtAuth+rateLimiter Cls:AuthenticatedTaskQueue Fn:submitTask,processNext,getDeadLetterQueue',
      '  @main.test.ts ⊢ Dep:all Fn:runVerificationSuite',
      ']',
    ].join('\n'),
    verboseArch: `Thank you PM-Spec! Based on your comprehensive PRD, I have designed a clean 4-module TypeScript architecture in \`src/\` with strict TypeScript types and zero third-party runtime dependencies:

1. \`src/jwtAuth.ts\`:
   - Exports \`JwtPayload\` interface, \`JwtAuthError\` class, \`signJwt()\`, and \`verifyJwt()\`. Uses base64url encoding and HMAC-SHA256 with \`crypto.timingSafeEqual\` to prevent timing side-channel attacks.

2. \`src/rateLimiter.ts\`:
   - Exports \`RateLimitDecision\` interface and \`TokenBucketRateLimiter\` class with lazy timestamp-based token replenishment in \`consume(tenantId, cost, nowMs)\`.

3. \`src/taskQueue.ts\`:
   - Imports \`verifyJwt\` from \`./jwtAuth\` and \`TokenBucketRateLimiter\` from \`./rateLimiter\`.
   - Exports \`AuthenticatedTaskQueue\` with \`submitTask()\`, \`processNext()\`, \`getDeadLetterQueue()\`, and \`getMetrics()\`.

4. \`src/main.test.ts\`:
   - Executes end-to-end assertions validating security, rate limiting, priority scheduling, and dead-letter handling.`,
    archSummaryZh: 'TypeScript 四模块微服务架构：jwtAuth 防篡改鉴权 → rateLimiter 令牌桶限流 → taskQueue 优先级+DLQ死信队列 → main.test 全链路自测。',
    files: [
      {
        filePath: 'src/jwtAuth.ts',
        role: 'HMAC-SHA256 常量时间防篡改 JWT 鉴权模块',
        moduleOrPackage: 'src/jwtAuth',
        expectedSymbols: ['JwtPayload', 'JwtAuthError', 'signJwt', 'verifyJwt'],
        dependencies: [],
        btContract: '@FILE:src/jwtAuth.ts ⊢ Ifc:JwtPayload,Cls:JwtAuthError Fn:signJwt,verifyJwt',
        btDraft: '#DRAFT[@jwtAuth.ts ⊢ b64url+HMAC+timingSafe ⊥ pure:ts]',
        verboseDraft:
          'I will start by building src/jwtAuth.ts using Node built-in node:crypto. I will implement base64url helpers, signJwt with iat/exp timestamps, and verifyJwt using crypto.timingSafeEqual on the HMAC-SHA256 digest buffer.',
        pureCode: `import * as crypto from 'node:crypto';

export type CallerRole = 'admin' | 'worker' | 'client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: CallerRole;
  iat: number;
  exp: number;
}

export class JwtAuthError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'JwtAuthError';
    this.code = code;
  }
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}

function fromBase64Url(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

function computeSignature(signingInput: string, secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(signingInput).digest();
}

export function signJwt(
  claims: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 300,
  nowMs: number = Date.now()
): string {
  if (!secret || secret.length < 8) {
    throw new JwtAuthError('WEAK_SECRET', 'JWT secret must be at least 8 characters');
  }
  const iat = Math.floor(nowMs / 1000);
  const fullPayload: JwtPayload = {
    ...claims,
    iat,
    exp: iat + ttlSeconds,
  };
  const headerSeg = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadSeg = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = \`\${headerSeg}.\${payloadSeg}\`;
  const sigSeg = toBase64Url(computeSignature(signingInput, secret));
  return \`\${signingInput}.\${sigSeg}\`;
}

export function verifyJwt(token: string, secret: string, nowMs: number = Date.now()): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtAuthError('MALFORMED_TOKEN', 'JWT must contain exact 3 segments');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const signingInput = \`\${headerSeg}.\${payloadSeg}\`;
  const expectedSig = computeSignature(signingInput, secret);
  const actualSig = fromBase64Url(sigSeg);

  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new JwtAuthError('INVALID_SIGNATURE', 'JWT cryptographic signature verification failed');
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadSeg).toString('utf8')) as JwtPayload;
  } catch {
    throw new JwtAuthError('INVALID_PAYLOAD', 'JWT payload is not valid JSON');
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (typeof payload.exp !== 'number' || nowSec >= payload.exp) {
    throw new JwtAuthError('TOKEN_EXPIRED', 'JWT token has expired');
  }

  return payload;
}
`,
      },
      {
        filePath: 'src/rateLimiter.ts',
        role: '多租户惰性补水令牌桶突发限流器',
        moduleOrPackage: 'src/rateLimiter',
        expectedSymbols: ['RateLimitDecision', 'TokenBucketRateLimiter', 'consume'],
        dependencies: [],
        btContract: '@FILE:src/rateLimiter.ts ⊢ Ifc:RateLimitDecision,Cls:TokenBucketRateLimiter Fn:consume',
        btDraft: '#DRAFT[@rateLimiter.ts ⊢ lazyRefill+consume ⊥ pure:ts]',
        verboseDraft:
          'Next, I will implement src/rateLimiter.ts with TokenBucketRateLimiter. Each tenant bucket starts at burstCapacity and refills proportionally to elapsed milliseconds since lastRefillMs, returning exact retryAfterMs when tokens are insufficient.',
        pureCode: `export interface RateLimitDecision {
  allowed: boolean;
  remainingTokens: number;
  retryAfterMs: number;
}

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly burstCapacity: number;
  private readonly refillTokensPerSec: number;

  constructor(burstCapacity: number, refillTokensPerSec: number) {
    if (burstCapacity <= 0 || refillTokensPerSec <= 0) {
      throw new Error('burstCapacity and refillTokensPerSec must be > 0');
    }
    this.burstCapacity = burstCapacity;
    this.refillTokensPerSec = refillTokensPerSec;
  }

  public consume(tenantId: string, cost = 1, nowMs: number = Date.now()): RateLimitDecision {
    if (cost <= 0) {
      throw new Error('cost must be > 0');
    }

    let state = this.buckets.get(tenantId);
    if (!state) {
      state = { tokens: this.burstCapacity, lastRefillMs: nowMs };
      this.buckets.set(tenantId, state);
    } else if (nowMs > state.lastRefillMs) {
      const elapsedSec = (nowMs - state.lastRefillMs) / 1000;
      const replenished = elapsedSec * this.refillTokensPerSec;
      state.tokens = Math.min(this.burstCapacity, state.tokens + replenished);
      state.lastRefillMs = nowMs;
    }

    if (state.tokens >= cost) {
      state.tokens -= cost;
      return {
        allowed: true,
        remainingTokens: Math.floor(state.tokens * 100) / 100,
        retryAfterMs: 0,
      };
    }

    const deficit = cost - state.tokens;
    const retryAfterMs = Math.ceil((deficit / this.refillTokensPerSec) * 1000);
    return {
      allowed: false,
      remainingTokens: Math.floor(state.tokens * 100) / 100,
      retryAfterMs,
    };
  }
}
`,
      },
      {
        filePath: 'src/taskQueue.ts',
        role: '鉴权限流一体化优先级任务队列与死信隔离引擎',
        moduleOrPackage: 'src/taskQueue',
        expectedSymbols: [
          'AuthenticatedTaskQueue',
          'submitTask',
          'processNext',
          'getDeadLetterQueue',
          'getMetrics',
        ],
        dependencies: ['src/jwtAuth.ts', 'src/rateLimiter.ts'],
        btContract:
          '@FILE:src/taskQueue.ts ⊢ Dep:./jwtAuth+./rateLimiter Cls:AuthenticatedTaskQueue Fn:submitTask,processNext,getDeadLetterQueue,getMetrics',
        btDraft: '#DRAFT[@taskQueue.ts ⇐ §SMFT ⊢ jwt+limit+prio+DLQ ⊥ pure:ts]',
        verboseDraft:
          'Now I will create src/taskQueue.ts importing verifyJwt from ./jwtAuth and TokenBucketRateLimiter from ./rateLimiter. I will enforce authentication and rate limits in submitTask, sort pending tasks by priority descending and sequence ascending, and move failing tasks to deadLetters once attempts reach maxAttempts.',
        faultyPollutedCode: `import { verifyJwt } from './jwtAuth';
import { TokenBucketRateLimiter } from './rateLimiter';

// ⟦BT:polluted_header⟧
export class AuthenticatedTaskQueue {
  constructor(private readonly secret: string, private readonly limiter: TokenBucketRateLimiter) {}
  public submitTask(token: string) {
    const claims = verifyJwt(token, this.secret);
    if (!claims.tenantId) ⇒ throw new Error('missing tenant');
  }
}
`,
        pureCode: `import { verifyJwt } from './jwtAuth';
import { TokenBucketRateLimiter } from './rateLimiter';

export type TaskState = 'PENDING' | 'COMPLETED' | 'DEAD_LETTER';

export interface QueuedTask {
  id: string;
  tenantId: string;
  submittedBy: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  state: TaskState;
  lastError?: string;
  seq: number;
}

export class RateLimitExceededError extends Error {
  public readonly retryAfterMs: number;

  constructor(tenantId: string, retryAfterMs: number) {
    super(\`Rate limit exceeded for tenant \${tenantId}; retry after \${retryAfterMs}ms\`);
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface QueueMetrics {
  pendingCount: number;
  completedCount: number;
  deadLetterCount: number;
}

export class AuthenticatedTaskQueue {
  private readonly jwtSecret: string;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly maxAttempts: number;
  private readonly pending: QueuedTask[] = [];
  private readonly deadLetters: QueuedTask[] = [];
  private completedCount = 0;
  private seqCounter = 0;

  constructor(jwtSecret: string, rateLimiter: TokenBucketRateLimiter, maxAttempts = 2) {
    this.jwtSecret = jwtSecret;
    this.rateLimiter = rateLimiter;
    this.maxAttempts = Math.max(1, maxAttempts);
  }

  public submitTask(
    token: string,
    type: string,
    payload: Record<string, unknown>,
    priority = 5,
    nowMs: number = Date.now()
  ): QueuedTask {
    const claims = verifyJwt(token, this.jwtSecret, nowMs);
    const limit = this.rateLimiter.consume(claims.tenantId, 1, nowMs);
    if (!limit.allowed) {
      throw new RateLimitExceededError(claims.tenantId, limit.retryAfterMs);
    }

    this.seqCounter += 1;
    const task: QueuedTask = {
      id: \`TSK-\${String(this.seqCounter).padStart(4, '0')}\`,
      tenantId: claims.tenantId,
      submittedBy: claims.sub,
      type,
      payload,
      priority,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      state: 'PENDING',
      seq: this.seqCounter,
    };

    this.pending.push(task);
    this.pending.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.seq - b.seq));
    return task;
  }

  public async processNext(handler: (task: QueuedTask) => Promise<void>): Promise<QueuedTask | null> {
    const task = this.pending.shift();
    if (!task) {
      return null;
    }

    task.attempts += 1;
    try {
      await handler(task);
      task.state = 'COMPLETED';
      this.completedCount += 1;
      return task;
    } catch (err: unknown) {
      task.lastError = err instanceof Error ? err.message : String(err);
      if (task.attempts < task.maxAttempts) {
        this.pending.push(task);
        this.pending.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.seq - b.seq));
      } else {
        task.state = 'DEAD_LETTER';
        this.deadLetters.push(task);
      }
      return task;
    }
  }

  public getDeadLetterQueue(): ReadonlyArray<QueuedTask> {
    return this.deadLetters;
  }

  public getMetrics(): QueueMetrics {
    return {
      pendingCount: this.pending.length,
      completedCount: this.completedCount,
      deadLetterCount: this.deadLetters.length,
    };
  }
}
`,
      },
      {
        filePath: 'src/main.test.ts',
        role: '鉴权篡改拦截、突发限流、优先级与死信自测套件',
        moduleOrPackage: 'src/main.test',
        expectedSymbols: ['runVerificationSuite'],
        dependencies: ['src/jwtAuth.ts', 'src/rateLimiter.ts', 'src/taskQueue.ts'],
        btContract: '@FILE:src/main.test.ts ⊢ Dep:all Fn:runVerificationSuite',
        btDraft: '#DRAFT[@main.test.ts ⇐ §SMFT ⊢ e2e(jwt+prio+dlq) ⊥ pure:ts]',
        verboseDraft:
          'Finally, I will implement src/main.test.ts to execute 4 deterministic assertions covering JWT tamper rejection, tenant rate-limit burst enforcement and window refill, priority execution order, and retry-to-DLQ isolation.',
        pureCode: `import { JwtAuthError, signJwt, verifyJwt } from './jwtAuth';
import { TokenBucketRateLimiter } from './rateLimiter';
import { AuthenticatedTaskQueue, RateLimitExceededError } from './taskQueue';

function assertCondition(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(\`Verification assertion failed: \${msg}\`);
  }
}

export async function runVerificationSuite(): Promise<void> {
  const secret = 'babeltele-super-secret-2026';
  const baseNow = 1_750_000_000_000;

  // 1. JWT sign + tamper detection
  const validToken = signJwt({ sub: 'svc-order', tenantId: 'tenant-alpha', role: 'worker' }, secret, 600, baseNow);
  const claims = verifyJwt(validToken, secret, baseNow + 5000);
  assertCondition(claims.tenantId === 'tenant-alpha', 'Decoded tenantId mismatch');

  let tamperCaught = false;
  try {
    verifyJwt(validToken.slice(0, -2) + 'xx', secret, baseNow + 5000);
  } catch (err) {
    tamperCaught = err instanceof JwtAuthError && err.code === 'INVALID_SIGNATURE';
  }
  assertCondition(tamperCaught, 'Tampered JWT signature must be rejected');

  // 2. Burst rate limiting & refill recovery
  const limiter = new TokenBucketRateLimiter(3, 2); // burst=3, refill=2/sec
  const queue = new AuthenticatedTaskQueue(secret, limiter, 2);

  queue.submitTask(validToken, 'email.send', { to: 'u1@example.com' }, 2, baseNow);
  queue.submitTask(validToken, 'invoice.render', { id: 99 }, 10, baseNow);
  queue.submitTask(validToken, 'poison.job', { bad: true }, 5, baseNow);

  let throttled = false;
  try {
    queue.submitTask(validToken, 'overflow.job', {}, 1, baseNow);
  } catch (err) {
    throttled = err instanceof RateLimitExceededError && err.retryAfterMs >= 500;
  }
  assertCondition(throttled, '4th burst submission must be throttled by token bucket');

  // 3. Priority execution order (priority 10 -> 5 -> 2) & DLQ routing
  const executionOrder: string[] = [];
  while (queue.getMetrics().pendingCount > 0) {
    await queue.processNext(async (task) => {
      executionOrder.push(\`\${task.type}#\${task.attempts}\`);
      if (task.type === 'poison.job') {
        throw new Error('Downstream timeout');
      }
    });
  }

  assertCondition(executionOrder[0] === 'invoice.render#1', 'Highest-priority task must execute first');
  assertCondition(
    executionOrder.includes('poison.job#1') && executionOrder.includes('poison.job#2'),
    'Poison job must retry exact maxAttempts=2 times'
  );
  assertCondition(queue.getDeadLetterQueue().length === 1, 'Poison job must land in DLQ');
  assertCondition(queue.getMetrics().completedCount === 2, 'Expected 2 completed tasks');

  // 4. Token bucket refill after 1 second allows new submission
  const recovered = queue.submitTask(validToken, 'recovered.job', {}, 5, baseNow + 1000);
  assertCondition(recovered.state === 'PENDING', 'Refilled bucket must accept new task');

  console.log('[PASS] TypeScript JWT TaskQueue Suite: 4/4 checks green (JWT + RateLimit + Prio + DLQ)');
}

void runVerificationSuite();
`,
      },
    ],
  },

  python: {
    id: 'python-async-risk-engine',
    language: 'python',
    titleZh: '异步滑动时间窗实时金融风控规则引擎',
    badgeZh: '🐍 Python 3.12 · Async 实时风控',
    defaultPromptZh:
      '使用 Python 开发一套异步滑动时间窗金融交易风控规则引擎：基于双端队列实现 O(1) 过期裁剪的账户实时交易频次、累计金额与跨国多设备跳跃统计，支持黑名单一票否决、多规则风险评分聚合（ALLOW / REVIEW / BLOCK）及完整 unittest 异步测试套件。',
    btPrd:
      '#PRD[dom:实时金融交易风控引擎 | lang:python | goals:deque滑动窗统计+黑名单拦截+高频与跨国跳变评分+异步批量评估 | inv:!Guard(O1_window_prune) & !Guard(score>=80=>BLOCK) | slo:unittest全绿]',
    verbosePrd: `Hello Team! Let me carefully translate the user's requirements into a comprehensive Product Requirements Document (PRD) for our Python Async Sliding-Window Financial Risk Rule Engine.

1. Business Context & Problem Statement:
Real-time payment gateways must evaluate every incoming transaction within milliseconds to detect card-testing velocity bursts, sudden high-value account draining, and impossible cross-border device hops, without leaking memory as historical transactions age out of the observation window.

2. Functional Specifications:
- Immutable Domain Models (models.py): Define \`RiskAction\` enum (\`ALLOW\`, \`REVIEW\`, \`BLOCK\`), \`TransactionEvent\`, \`RuleHit\`, and \`RiskDecision\` dataclasses with strict input validation.
- O(1) Amortized Sliding-Window Tracker (sliding_window.py): Use \`collections.deque\` per account to evict expired events older than \`window_seconds\` from the left while computing rolling transaction count, cumulative amount, distinct countries, and distinct devices.
- Async Risk Rule Engine (rule_engine.py): Provide \`AsyncRiskRuleEngine\` with \`blacklist_account()\`, \`async def evaluate(event)\`, and \`async def evaluate_batch(events)\`. Aggregate weighted rule hits so scores >= 80 trigger \`BLOCK\`, scores >= 40 trigger \`REVIEW\`, and < 40 return \`ALLOW\`.
- Automated Unit Tests (test_risk_engine.py): Use \`unittest.IsolatedAsyncioTestCase\` to verify normal transactions, burst velocity blocking, cross-border device hop scoring, and window expiration recovery.`,
    btArch: [
      '#ARCH[proj:risk-engine | mod:root',
      '  @models.py ⊢ Enum:RiskAction,Rec:TransactionEvent,RuleHit,RiskDecision',
      '  @sliding_window.py ⊢ Dep:models Rec:WindowSnapshot,Cls:SlidingWindowTracker Fn:record_and_measure',
      '  @rule_engine.py ⊢ Dep:models+window Cls:AsyncRiskRuleEngine Fn:evaluate,evaluate_batch',
      '  @test_risk_engine.py ⊢ Dep:all Cls:TestAsyncRiskEngine',
      ']',
    ].join('\n'),
    verboseArch: `Thank you PM-Spec! I have designed a clean 4-file Python 3 architecture leveraging standard library \`dataclasses\`, \`collections.deque\`, \`asyncio\`, and \`unittest\`:

1. \`models.py\`:
   - Defines \`RiskAction(Enum)\`, \`TransactionEvent\`, \`RuleHit\`, and \`RiskDecision\`. Validates that transaction amounts are strictly positive.

2. \`sliding_window.py\`:
   - Imports \`TransactionEvent\` from \`models\`.
   - Implements \`SlidingWindowTracker\` and \`WindowSnapshot\` with \`prune_expired(account_id, now_sec)\` and \`record_and_measure(event)\`.

3. \`rule_engine.py\`:
   - Imports models and \`SlidingWindowTracker\`.
   - Implements \`AsyncRiskRuleEngine\` evaluating blacklist status, burst velocity, rolling amount threshold, and multi-country/device anomalies asynchronously.

4. \`test_risk_engine.py\`:
   - Implements \`TestAsyncRiskEngine(unittest.IsolatedAsyncioTestCase)\` with 4 comprehensive async test methods.`,
    archSummaryZh: 'Python 四模块实时风控架构：models 领域数据类 → sliding_window 双端队列时间窗 → rule_engine 异步多规则评分 → test_risk_engine 异步单测套件。',
    files: [
      {
        filePath: 'models.py',
        role: '风控交易事件与决策结果不可变数据模型',
        moduleOrPackage: 'models',
        expectedSymbols: ['RiskAction', 'TransactionEvent', 'RuleHit', 'RiskDecision'],
        dependencies: [],
        btContract: '@FILE:models.py ⊢ Enum:RiskAction,Rec:TransactionEvent,RuleHit,RiskDecision',
        btDraft: '#DRAFT[@models.py ⊢ Enum+dataclass(Event,Decision) ⊥ pure:py]',
        verboseDraft:
          'I will start with models.py, defining RiskAction as an Enum and TransactionEvent, RuleHit, and RiskDecision as Python dataclasses, including __post_init__ validation on TransactionEvent.',
        pureCode: `from dataclasses import dataclass, field
from enum import Enum
from typing import List


class RiskAction(Enum):
    ALLOW = "ALLOW"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


@dataclass(frozen=True)
class TransactionEvent:
    tx_id: str
    account_id: str
    amount: float
    currency: str
    country: str
    device_id: str
    timestamp_sec: float

    def __post_init__(self) -> None:
        if not self.tx_id or not self.account_id:
            raise ValueError("tx_id and account_id must be non-empty")
        if self.amount <= 0:
            raise ValueError("amount must be > 0")


@dataclass(frozen=True)
class RuleHit:
    rule_id: str
    score: int
    reason: str


@dataclass
class RiskDecision:
    tx_id: str
    account_id: str
    action: RiskAction
    total_score: int
    hits: List[RuleHit] = field(default_factory=list)
`,
      },
      {
        filePath: 'sliding_window.py',
        role: '基于双端队列的 O(1) 滑动时间窗行为聚合器',
        moduleOrPackage: 'sliding_window',
        expectedSymbols: ['WindowSnapshot', 'SlidingWindowTracker', 'record_and_measure', 'prune_expired'],
        dependencies: ['models.py'],
        btContract: '@FILE:sliding_window.py ⊢ Dep:models Rec:WindowSnapshot,Cls:SlidingWindowTracker',
        btDraft: '#DRAFT[@sliding_window.py ⇐ §SMFT ⊢ deque_prune ⊥ pure:py]',
        verboseDraft:
          'Next, I will implement sliding_window.py importing TransactionEvent from models. Each account gets a collections.deque sorted chronologically so expired events older than now - window_seconds are popped from the left in O(1) amortized time.',
        pureCode: `from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict
from models import TransactionEvent


@dataclass(frozen=True)
class WindowSnapshot:
    tx_count: int
    rolling_amount: float
    distinct_countries: int
    distinct_devices: int


class SlidingWindowTracker:
    def __init__(self, window_seconds: float = 60.0) -> None:
        if window_seconds <= 0:
            raise ValueError("window_seconds must be > 0")
        self.window_seconds = window_seconds
        self._windows: Dict[str, Deque[TransactionEvent]] = {}

    def prune_expired(self, account_id: str, now_sec: float) -> None:
        bucket = self._windows.get(account_id)
        if not bucket:
            return
        cutoff = now_sec - self.window_seconds
        while bucket and bucket[0].timestamp_sec < cutoff:
            bucket.popleft()
        if not bucket:
            del self._windows[account_id]

    def record_and_measure(self, event: TransactionEvent) -> WindowSnapshot:
        self.prune_expired(event.account_id, event.timestamp_sec)
        bucket = self._windows.setdefault(event.account_id, deque())
        bucket.append(event)

        rolling_amount = sum(item.amount for item in bucket)
        countries = {item.country for item in bucket}
        devices = {item.device_id for item in bucket}

        return WindowSnapshot(
            tx_count=len(bucket),
            rolling_amount=round(rolling_amount, 2),
            distinct_countries=len(countries),
            distinct_devices=len(devices),
        )
`,
      },
      {
        filePath: 'rule_engine.py',
        role: '异步多维规则评分聚合与黑名单熔断风控引擎',
        moduleOrPackage: 'rule_engine',
        expectedSymbols: ['AsyncRiskRuleEngine', 'blacklist_account', 'evaluate', 'evaluate_batch'],
        dependencies: ['models.py', 'sliding_window.py'],
        btContract: '@FILE:rule_engine.py ⊢ Dep:models+sliding_window Cls:AsyncRiskRuleEngine Fn:evaluate,evaluate_batch',
        btDraft: '#DRAFT[@rule_engine.py ⇐ §SMFT ⊢ eval(blk+vel+geo) ⊥ pure:py]',
        verboseDraft:
          'Now I will write rule_engine.py importing our domain models and SlidingWindowTracker. AsyncRiskRuleEngine will synchronize access with an asyncio.Lock, check blacklisted accounts, compute window metrics, evaluate velocity, cumulative amount, and geo-hop rules, and support concurrent batch evaluation.',
        faultyPollutedCode: `import asyncio
from models import RiskAction, TransactionEvent, RiskDecision
from sliding_window import SlidingWindowTracker

# #HDR[leaked_bt_header]
class AsyncRiskRuleEngine:
    def __init__(self) -> None:
        self._tracker = SlidingWindowTracker(60.0)

    async def evaluate(self, event: TransactionEvent) -> RiskDecision:
        if event.amount > 10000 ⇒ return RiskDecision(event.tx_id, event.account_id, RiskAction.BLOCK, 100, [])
`,
        pureCode: `import asyncio
from typing import Iterable, List, Set
from models import RiskAction, RiskDecision, RuleHit, TransactionEvent
from sliding_window import SlidingWindowTracker


class AsyncRiskRuleEngine:
    def __init__(
        self,
        window_seconds: float = 60.0,
        max_velocity_tx: int = 4,
        rolling_amount_limit: float = 5000.0,
    ) -> None:
        self._tracker = SlidingWindowTracker(window_seconds=window_seconds)
        self._max_velocity_tx = max_velocity_tx
        self._rolling_amount_limit = rolling_amount_limit
        self._blacklisted_accounts: Set[str] = set()
        self._lock = asyncio.Lock()

    def blacklist_account(self, account_id: str) -> None:
        self._blacklisted_accounts.add(account_id)

    async def evaluate(self, event: TransactionEvent) -> RiskDecision:
        async with self._lock:
            hits: List[RuleHit] = []

            if event.account_id in self._blacklisted_accounts:
                hits.append(RuleHit("R_BLACKLIST", 100, "Account is on active risk blacklist"))
            else:
                snap = self._tracker.record_and_measure(event)

                if snap.tx_count > self._max_velocity_tx:
                    hits.append(
                        RuleHit(
                            "R_VELOCITY_BURST",
                            85,
                            f"Burst tx_count={snap.tx_count} exceeds {self._max_velocity_tx} in window",
                        )
                    )

                if snap.rolling_amount > self._rolling_amount_limit:
                    hits.append(
                        RuleHit(
                            "R_ROLLING_AMOUNT",
                            50,
                            f"Rolling sum {snap.rolling_amount:.2f} exceeds {self._rolling_amount_limit:.2f}",
                        )
                    )

                if snap.distinct_countries >= 2:
                    hits.append(
                        RuleHit(
                            "R_GEO_HOP",
                            45,
                            f"Cross-border hop across {snap.distinct_countries} countries within window",
                        )
                    )

                if snap.distinct_devices >= 3:
                    hits.append(
                        RuleHit(
                            "R_MULTI_DEVICE",
                            35,
                            f"Account switched across {snap.distinct_devices} devices within window",
                        )
                    )

            total_score = sum(h.score for h in hits)
            if total_score >= 80:
                action = RiskAction.BLOCK
            elif total_score >= 40:
                action = RiskAction.REVIEW
            else:
                action = RiskAction.ALLOW

            return RiskDecision(
                tx_id=event.tx_id,
                account_id=event.account_id,
                action=action,
                total_score=total_score,
                hits=hits,
            )

    async def evaluate_batch(self, events: Iterable[TransactionEvent]) -> List[RiskDecision]:
        results: List[RiskDecision] = []
        for ev in events:
            results.append(await self.evaluate(ev))
        return results
`,
      },
      {
        filePath: 'test_risk_engine.py',
        role: '异步滑动时间窗风控全场景单元测试套件',
        moduleOrPackage: 'test_risk_engine',
        expectedSymbols: ['TestAsyncRiskEngine'],
        dependencies: ['models.py', 'sliding_window.py', 'rule_engine.py'],
        btContract: '@FILE:test_risk_engine.py ⊢ Dep:models+rule_engine Cls:TestAsyncRiskEngine',
        btDraft: '#DRAFT[@test_risk_engine.py ⇐ §SMFT ⊢ 4_async_tests ⊥ pure:py]',
        verboseDraft:
          'Finally, I will write test_risk_engine.py using unittest.IsolatedAsyncioTestCase to verify clean transactions, high-velocity burst blocking, cross-border high-amount combinations, and sliding-window expiration recovery.',
        pureCode: `import unittest
from models import RiskAction, TransactionEvent
from rule_engine import AsyncRiskRuleEngine


class TestAsyncRiskEngine(unittest.IsolatedAsyncioTestCase):
    async def test_clean_low_risk_transaction_allowed(self) -> None:
        engine = AsyncRiskRuleEngine(window_seconds=60.0, max_velocity_tx=4, rolling_amount_limit=5000.0)
        ev = TransactionEvent("tx-1", "acct-clean", 120.0, "USD", "US", "dev-1", 1000.0)
        decision = await engine.evaluate(ev)
        self.assertEqual(decision.action, RiskAction.ALLOW)
        self.assertEqual(decision.total_score, 0)

    async def test_velocity_burst_triggers_block(self) -> None:
        engine = AsyncRiskRuleEngine(window_seconds=60.0, max_velocity_tx=3, rolling_amount_limit=5000.0)
        events = [
            TransactionEvent(f"tx-v{i}", "acct-burst", 25.0, "USD", "US", "dev-1", 2000.0 + i * 5)
            for i in range(4)
        ]
        decisions = await engine.evaluate_batch(events)
        self.assertEqual(decisions[2].action, RiskAction.ALLOW)
        self.assertEqual(decisions[3].action, RiskAction.BLOCK)
        self.assertTrue(any(h.rule_id == "R_VELOCITY_BURST" for h in decisions[3].hits))

    async def test_geo_hop_plus_high_amount_escalates_to_block(self) -> None:
        engine = AsyncRiskRuleEngine(window_seconds=60.0, max_velocity_tx=5, rolling_amount_limit=3000.0)
        d1 = await engine.evaluate(
            TransactionEvent("tx-g1", "acct-travel", 1800.0, "USD", "US", "dev-a", 3000.0)
        )
        self.assertEqual(d1.action, RiskAction.ALLOW)

        d2 = await engine.evaluate(
            TransactionEvent("tx-g2", "acct-travel", 1900.0, "USD", "SG", "dev-b", 3020.0)
        )
        # R_ROLLING_AMOUNT (50) + R_GEO_HOP (45) = 95 => BLOCK
        self.assertEqual(d2.action, RiskAction.BLOCK)
        self.assertEqual(d2.total_score, 95)

    async def test_sliding_window_expiration_recovers_account(self) -> None:
        engine = AsyncRiskRuleEngine(window_seconds=60.0, max_velocity_tx=2, rolling_amount_limit=5000.0)
        await engine.evaluate(TransactionEvent("tx-e1", "acct-exp", 50.0, "USD", "US", "d1", 5000.0))
        await engine.evaluate(TransactionEvent("tx-e2", "acct-exp", 50.0, "USD", "US", "d1", 5010.0))
        blocked = await engine.evaluate(TransactionEvent("tx-e3", "acct-exp", 50.0, "USD", "US", "d1", 5020.0))
        self.assertEqual(blocked.action, RiskAction.BLOCK)

        # 65 seconds later, all prior events have aged out of the 60s window
        recovered = await engine.evaluate(TransactionEvent("tx-e4", "acct-exp", 50.0, "USD", "US", "d1", 5086.0))
        self.assertEqual(recovered.action, RiskAction.ALLOW)


if __name__ == "__main__":
    unittest.main()
`,
      },
    ],
  },
};

export function getShowcaseBlueprint(language: TargetLanguage): ShowcaseBlueprint {
  return SHOWCASE_BLUEPRINTS[language];
}

export function blueprintToManifest(
  blueprint: ShowcaseBlueprint,
  customPrompt?: string
): ArchitectManifest {
  return {
    projectName: blueprint.id,
    language: blueprint.language,
    btArchSpec: blueprint.btArch,
    verboseArchSpec: blueprint.verboseArch,
    humanSummaryZh: customPrompt
      ? `${blueprint.archSummaryZh}（适配需求：${customPrompt.slice(0, 48)}）`
      : blueprint.archSummaryZh,
    files: blueprint.files.map((f) => ({
      filePath: f.filePath,
      role: f.role,
      moduleOrPackage: f.moduleOrPackage,
      expectedSymbols: f.expectedSymbols,
      btContract: f.btContract,
      dependencies: f.dependencies,
    })),
  };
}
