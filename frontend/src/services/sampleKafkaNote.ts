import type { Note, Settings } from "../types";

export function createSampleKafkaNote(settings: Settings): Note {
  const now = new Date().toISOString();
  return {
    videoId: "kafka-mastery-demo",
    title: "Apache Kafka: Complete Detailed Notes",
    theme: "violet",
    createdAt: now,
    updatedAt: now,
    settings,
    versions: [
      {
        id: "v1-initial",
        createdAt: now,
        instruction: "Comprehensive study notes matching 24-page reference guide",
        html: sampleKafkaHtml,
      },
    ],
    activeVersion: 0,
    html: sampleKafkaHtml,
  };
}

export const sampleKafkaHtml = `
<header class="note-cover">
  <h1>Apache Kafka</h1>
  <p class="subtitle">Complete Detailed Notes — From Beginner to Advanced</p>
  <p class="description">An in-depth, example-rich study guide covering asynchronous processing patterns, message queues, event streaming, and the complete internal working of Apache Kafka — topics, partitions, brokers, replication, offsets, consumer groups, delivery guarantees, backpressure, metadata, the full producer/consumer write & read path, and Kafka vs. RabbitMQ / Pub-Sub — with worked numeric examples, code snippets, and 20+ diagrams.</p>
  <div class="badge-pill">Compiled & expanded from a detailed video lecture on Kafka</div>
</header>

<section class="toc-section">
  <h2>Table of Contents</h2>
  <ol class="toc-list">
    <li>The Problem: Why Asynchronous Processing?</li>
    <li>Seven Ways to Do Asynchronous Processing (with code & examples)</li>
    <li>Message Queue vs Event Streaming — In Depth</li>
    <li>Is Kafka a Message Queue or an Event Stream?</li>
    <li>Understanding Kafka with a Real-Life Analogy (Sports)</li>
    <li>Core Kafka Concepts — Full Technical Deep Dive</li>
    <li>How Consumers Actually Read Data (Poll / Long-Poll Model)</li>
    <li>Replication & the Leader-Follower Model (in depth)</li>
    <li>Kafka Metadata & the Controller (full worked example)</li>
    <li>End-to-End Kafka Flow — Every Step, With Numbers</li>
    <li>Handling Wrong / Bad Data in Kafka</li>
    <li>Delivery Guarantees — At-most / At-least / Exactly-once</li>
    <li>Backpressure — The Full Explanation</li>
    <li>Frequently Asked Questions — Deep Dive</li>
    <li>Why Kafka Handles Massive Reads & Writes</li>
    <li>Kafka vs Pub/Sub & RabbitMQ Comparison</li>
    <li>Final Summary Cheat-Sheet & Big-Picture Model</li>
  </ol>
</section>

<section>
  <h2>1. The Problem: Why Asynchronous Processing?</h2>
  <h3>1.1 The Amazon Order Example</h3>
  <p>Imagine a system like <strong>Amazon</strong>. When a user places an order, a substantial amount of work must happen behind the scenes before the order flow is truly complete:</p>
  <ul>
    <li>Save the order in the primary database</li>
    <li>Reduce inventory count (e.g. 30 units → 29 units)</li>
    <li>Send an order confirmation email to the user</li>
    <li>Send an SMS status message</li>
    <li>Notify the fulfillment warehouse so items are picked and packed</li>
    <li>Generate a formal tax invoice and update analytics dashboards</li>
  </ul>

  <div class="flow-diagram">
    <div class="flow-node highlight">User Places Order</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node highlight">Order Service</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node accent">Inventory Service</div>
    <div class="flow-node accent">Email Service</div>
    <div class="flow-node accent">SMS Service</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node warm">Response sent to user (only after ALL finish)</div>
  </div>

  <h3>1.2 The Naive (Synchronous) Approach and Its Problems</h3>
  <p>A brute-force synchronous pipeline (<code class="pill">order → inventory → email → SMS → warehouse</code>) introduces three catastrophic architectural flaws:</p>
  <ol>
    <li><strong>Extreme Latency:</strong> The end-user is blocked until every single downstream task finishes. The user only wants confirmation that their order is accepted.</li>
    <li><strong>The Slowest Link Determines Overall Speed:</strong> If an external email or analytics microservice is sluggish, the entire checkout process grinds to a halt.</li>
    <li><strong>Cascading Failure:</strong> If any single non-critical microservice (e.g., analytics or marketing SMS) is down, the entire user transaction fails completely.</li>
  </ol>

  <div class="callout analogy">
    <strong>Real-Life Analogy — Ordering Food at a Counter:</strong>
    <p>Picture a food counter. You place an order for pizza. If the cashier makes you stand frozen right at the counter window while the pizza dough is kneaded, baked, and sliced for 20 minutes, the entire queue is blocked! Instead, they immediately hand you an order token (e.g., <em>"Order #32"</em>). With that token in hand, you are completely unblocked — you can sit down, read, or drink water. When the pizza is ready, your number is called. That token decoupling is the essence of asynchronous architecture.</p>
  </div>

  <div class="callout takeaway">
    <strong>Key Takeaway:</strong> Whenever there is work that does not strictly need to block the caller's immediate response, that work should be moved off the critical path and processed asynchronously in the background.
  </div>
</section>

<section>
  <h2>2. Seven Ways to Do Asynchronous Processing</h2>
  <p>Before diving into Apache Kafka, here is the architectural landscape of asynchronous patterns and their trade-offs:</p>

  <h3>2.1 Background Threads / In-Memory Executors</h3>
  <p>The simplest pattern: dispatch a background worker thread within the process space:</p>
  <pre><code class="language-java">executor.submit(() -> {
    // perform asynchronous background action
    emailService.sendConfirmation(orderId);
    cacheService.invalidate(userId);
});</code></pre>

  <table>
    <thead>
      <tr>
        <th>Option</th>
        <th>Reliable?</th>
        <th>Scalable?</th>
        <th>When to Use</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. In-Memory Threads</strong></td>
        <td>✗ No — job lost if the machine goes down</td>
        <td>✗ No — tied to one machine, not distributed</td>
        <td>Small single-server utilities, POCs</td>
      </tr>
      <tr>
        <td><strong>2. Database Polling</strong></td>
        <td>✓ Yes — DB is persistent storage</td>
        <td>✗ No — heavy read+write load on the DB</td>
        <td>Low-throughput batch systems</td>
      </tr>
      <tr>
        <td><strong>3. Cron Jobs</strong></td>
        <td>✓ Yes — predictable schedule</td>
        <td>Limited — not meant to scale for user-triggered work</td>
        <td>Daily invoices, cleanup routines</td>
      </tr>
      <tr>
        <td><strong>4. Webhooks</strong></td>
        <td>Only with retries built in</td>
        <td>Moderate — network-coupled</td>
        <td>Third-party integrations (Stripe, GitHub)</td>
      </tr>
      <tr>
        <td><strong>5. Serverless (Lambda)</strong></td>
        <td>✓ Yes (auto-scaling)</td>
        <td>✓ Yes — pay-per-invocation</td>
        <td>Cloud-native systems with spiky/unpredictable load</td>
      </tr>
      <tr>
        <td><strong>6. Message Queues (RabbitMQ)</strong></td>
        <td>✓ Yes — task persists in the queue until consumed</td>
        <td>✓ Yes — task distribution</td>
        <td>Point-to-point task queues (one worker per job)</td>
      </tr>
      <tr>
        <td><strong>7. Event Streaming (Kafka)</strong></td>
        <td>✓ Yes — events persist in the log for the retention period</td>
        <td>✓ Excellent (this is why Kafka scales so well)</td>
        <td>High-throughput streaming, multi-consumer fanout</td>
      </tr>
    </tbody>
  </table>
</section>

<section>
  <h2>3. Message Queue vs Event Streaming — In Depth</h2>
  <p>A frequent interview question and system design pitfall is confusing message queues with event streaming platforms.</p>

  <div class="grid-2">
    <div class="callout insight">
      <strong>Message Queue (e.g. RabbitMQ)</strong>
      <p>Stores <em>mutable tasks</em> to be performed once. The moment a single consumer acknowledges receipt, the message is permanently deleted from the queue. Only one consumer receives each message.</p>
    </div>
    <div class="callout insight">
      <strong>Event Stream (e.g. Apache Kafka)</strong>
      <p>Stores an <em>immutable sequence of historical facts</em> in an append-only commit log. Events are <strong>never deleted</strong> upon reading. They persist for the retention window (e.g., 7–30 days), allowing multiple independent consumers to read at their own pace and replay anytime.</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Architectural Aspect</th>
        <th>Message Queue (RabbitMQ)</th>
        <th>Event Streaming (Apache Kafka)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>What is stored?</strong></td>
        <td>Tasks / To-Do jobs</td>
        <td>Events (Immutable historical facts)</td>
      </tr>
      <tr>
        <td><strong>Consumers per item</strong></td>
        <td>Exactly one consumer gets each task</td>
        <td>Multiple independent consumer groups read the same event</td>
      </tr>
      <tr>
        <td><strong>Message Lifetime</strong></td>
        <td>Deleted immediately after consumption</td>
        <td>Retained for days/weeks regardless of consumption</td>
      </tr>
      <tr>
        <td><strong>Replay Capability</strong></td>
        <td>✗ Impossible (Data is gone)</td>
        <td>✓ Seamless (Rewind offset pointer to replay)</td>
      </tr>
      <tr>
        <td><strong>Consumer State</strong></td>
        <td>Managed by the broker broker-side</td>
        <td>Managed by consumers via partition offsets</td>
      </tr>
      <tr>
        <td><strong>Throughput</strong></td>
        <td>Tens of thousands msgs/sec</td>
        <td>Millions of events/sec via sequential I/O & page cache</td>
      </tr>
    </tbody>
  </table>

  <div class="callout takeaway">
    <strong>The 3 Fundamental Differences:</strong>
    (1) Task vs Event, (2) Single consumer vs Multiple independent consumer groups, (3) Deleted on consumption vs Retained for historical replay.
  </div>
</section>

<section>
  <h2>4. Understanding Kafka with a Real-Life Analogy (Sports)</h2>
  <p>To grasp Kafka's moving parts, imagine a comprehensive <strong>Global Sports Tracking System</strong>:</p>

  <table>
    <thead>
      <tr>
        <th>Real-Life Concept</th>
        <th>Kafka Architecture Equivalent</th>
        <th>Explanation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>The Entire Sports System</td>
        <td><strong>Kafka Cluster</strong></td>
        <td>Contains all events across all sports</td>
      </tr>
      <tr>
        <td>A Specific Sport (Football, Cricket)</td>
        <td><strong>Topic</strong></td>
        <td>A logical stream/category of related event records</td>
      </tr>
      <tr>
        <td>An Individual Match (IND vs PAK)</td>
        <td><strong>Partition</strong></td>
        <td>The physical append-only storage unit holding sequenced events</td>
      </tr>
      <tr>
        <td>Stadium Machine</td>
        <td><strong>Broker</strong></td>
        <td>A physical server/node in the cluster hosting partition logs</td>
      </tr>
      <tr>
        <td>Referee / Umpire</td>
        <td><strong>Producer</strong></td>
        <td>Publishes facts (<code class="pill">goal_scored</code>, <code class="pill">wicket_down</code>)</td>
      </tr>
      <tr>
        <td>Cricbuzz, Hotstar, ESPN</td>
        <td><strong>Consumer Groups</strong></td>
        <td>Independent applications reading the event stream</td>
      </tr>
    </tbody>
  </table>

  <div class="callout question">
    <div class="q-title">Q: Is a Topic the same as an Event?</div>
    <p><strong>No.</strong> A topic is a broad category that contains multiple distinct event types. For example, the topic <code class="pill">cricket_events</code> carries <code class="pill">ball_bowled</code>, <code class="pill">boundary_hit</code>, <code class="pill">wicket_fallen</code>, and <code class="pill">match_ended</code>. Each is a distinct event payload published to the same topic stream.</p>
  </div>

  <div class="callout analogy">
    <strong>The Suitcase & Small Bags Analogy (Why Partitions Exist):</strong>
    <p>Think of packing a large suitcase. If you throw all clothes loosely into one massive 50kg bag, moving or sharing the weight is impossible. If the bag rips, everything is lost. Instead, you pack clothes into 5 modular packing cubes (partitions). Now, you can distribute those cubes across multiple suitcases (brokers), load-balance between carriers, and process them in parallel.</p>
  </div>
</section>

<section>
  <h2>5. Core Kafka Concepts — Full Technical Deep Dive</h2>

  <h3>5.1 Topics & Partitions</h3>
  <p>A topic is purely a logical namespace; actual data lives inside <strong>Partitions</strong>. Each partition is an ordered, immutable, append-only log file on disk.</p>

  <div class="callout warning">
    <strong>Critical Ordering Rule:</strong>
    Ordering is <strong>strictly guaranteed within a single partition</strong>. Kafka does NOT guarantee global ordering across different partitions. Events with the same partition key always hash to the same partition (<code class="pill">hash(key) % num_partitions</code>), preserving sequential ordering where it actually matters (e.g. for a specific customer or order ID).
  </div>

  <h3>5.2 Partition Hashing Formula</h3>
  <pre><code class="language-java">// Partition Assignment Logic
int targetPartition = Math.abs(key.hashCode()) % totalPartitions;
// Example: orderId = 123 -> hash = 4 -> 4 % 3 = Partition 1</code></pre>

  <p>Because <code class="pill">order_123</code> will always produce the exact same hash, every event related to order 123 lands on Partition 1 in chronological sequence.</p>

  <h3>5.3 The Golden Rule of Consumer Groups</h3>
  <div class="callout takeaway">
    <strong>The Golden Rule:</strong> Within a single Consumer Group, only <strong>one consumer</strong> may read from a given partition at any time. However, a single consumer can read from multiple partitions. Multiple distinct consumer groups can read from the exact same partition simultaneously without interfering with each other.
  </div>

  <div class="callout question">
    <div class="q-title">Q: Can a consumer exist without belonging to a consumer group?</div>
    <p><strong>No.</strong> Every consumer belongs to a consumer group. If you do not supply a <code class="pill">group.id</code>, Kafka auto-assigns one. Think of it like employment: an employee (consumer) always belongs to an organization (consumer group).</p>
  </div>
</section>

<section>
  <h2>6. Offsets, Crash Recovery & Delivery Guarantees</h2>
  <p>An <strong>offset</strong> is a sequential integer bookmark assigned to each record in a partition. It uniquely tracks progress.</p>

  <div class="flow-diagram">
    <div class="flow-node">Consumer polls offset 20-30</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node warm">Service Crashes mid-batch</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node">Offset in Kafka stays at 20</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node accent">Consumer restarts & safely re-processes 20-30</div>
  </div>

  <h3>Delivery Guarantees Compared</h3>
  <table>
    <thead>
      <tr>
        <th>Guarantee</th>
        <th>Commit Timing</th>
        <th>Failure Trade-off</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>At-Most-Once</strong></td>
        <td>Committed immediately upon fetch before processing</td>
        <td>Crash causes permanent message loss (never reprocessed)</td>
      </tr>
      <tr>
        <td><strong>At-Least-Once (Default)</strong></td>
        <td>Committed only after work completes successfully</td>
        <td>Crash may cause duplicate processing; zero data loss</td>
      </tr>
      <tr>
        <td><strong>Exactly-Once (EOS)</strong></td>
        <td>Transactional 2-phase commit with Kafka transactions</td>
        <td>Highest coordination overhead; essential for financial ledgers</td>
      </tr>
    </tbody>
  </table>

  <div class="callout warning">
    <strong>Why Kafka Defaults to At-Least-Once:</strong>
    Lost data is irreversible. Duplicate events, on the other hand, can be easily handled idempotently in application logic (e.g. database upserts or deduplication keys).
  </div>
</section>

<section>
  <h2>7. Frequently Asked Questions — Deep Dive</h2>

  <div class="callout question">
    <div class="q-title">Q: How does Kafka achieve massive write & read throughput?</div>
    <p>Kafka leverages 5 architectural breakthroughs: (1) <strong>Sequential Disk I/O</strong> avoiding random seek bottlenecks, (2) <strong>Zero-Copy Transfer (sendfile)</strong> bypassing user-space memory copies, (3) Heavy reliance on the OS <strong>Page Cache</strong>, (4) Batching of records, and (5) Horizontal scaling across partitioned brokers.</p>
  </div>

  <div class="callout question">
    <div class="q-title">Q: Why does Kafka use a Pull model instead of a Push model?</div>
    <p>Pushing forces data onto consumers regardless of their processing capability, causing memory exhaustion and crashes (backpressure). Kafka's <strong>Pull model</strong> lets every consumer query at its own natural cadence, naturally and gracefully absorbing traffic spikes.</p>
  </div>

  <div class="callout question">
    <div class="q-title">Q: Where is partition offset metadata durably stored?</div>
    <p>Offsets are committed to a special internal, compact, highly replicated Kafka topic named <code class="pill">__consumer_offsets</code>, keyed by <code class="pill">(consumer_group, topic, partition)</code>.</p>
  </div>
</section>

<section>
  <h2>8. Final Summary Cheat-Sheet & Big-Picture Model</h2>

  <table>
    <thead>
      <tr>
        <th>Core Concept</th>
        <th>One-Line Architectural Definition</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Topic</strong></td>
        <td>Logical category / stream name for related event payloads</td>
      </tr>
      <tr>
        <td><strong>Partition</strong></td>
        <td>Physical append-only commit log; fundamental unit of parallelism & storage</td>
      </tr>
      <tr>
        <td><strong>Broker</strong></td>
        <td>Individual server node storing partition logs and serving client I/O</td>
      </tr>
      <tr>
        <td><strong>Consumer Group</strong></td>
        <td>Coordinated pool of workers dividing partition consumption without duplicate effort</td>
      </tr>
      <tr>
        <td><strong>Offset</strong></td>
        <td>Monotonically increasing integer bookmark tracking read position</td>
      </tr>
      <tr>
        <td><strong>ISR (In-Sync Replicas)</strong></td>
        <td>Set of follower replicas fully caught up with the partition leader</td>
      </tr>
      <tr>
        <td><strong>KRaft</strong></td>
        <td>Kafka Raft consensus protocol replacing legacy ZooKeeper for metadata</td>
      </tr>
    </tbody>
  </table>

  <div class="flow-diagram">
    <div class="flow-node highlight">Producers</div>
    <div class="flow-arrow">──Write──▶</div>
    <div class="flow-node highlight">Kafka Cluster (Brokers + Partitions + ISR)</div>
    <div class="flow-arrow">◀──Poll──</div>
    <div class="flow-node accent">Independent Consumer Groups (A, B, C)</div>
  </div>

  <div class="callout insight">
    <strong>Big-Picture Mental Model:</strong>
    Think of Kafka as a <em>distributed, durable, append-only disk commit log</em> paired with Pub/Sub semantics. Producers append facts; consumers read bookmarks at their own pace; data is preserved for replay.
  </div>
</section>
`;
