import { AnchorMap } from './anchor.types';

export const APIS_ANCHORS: AnchorMap = {
  'rest-http-basics': {
    beginner: [
      'what REST is and what a resource is',
      'GET, POST, PUT, PATCH and DELETE and what each is for',
      'what stateless means for a REST API',
      'what is in an HTTP request and response',
    ],
    intermediate: [
      'PUT versus PATCH and which are safe or idempotent',
      'design resource URLs for a given domain, with nesting and naming',
      'HTTP caching headers on an API response',
    ],
    advanced: [
      'when REST fits and when it does not, versus RPC or GraphQL',
      'hypermedia (HATEOAS): what it buys and why teams skip it',
      'long-running operations via 202 Accepted and job resources',
    ],
  },
  'status-errors': {
    beginner: [
      '200, 201, 204, 400, 401, 403, 404 and 500 and what each means',
      '401 versus 403',
      'why not to return 200 for an error',
    ],
    intermediate: [
      '400 versus 422 versus 409 for validation and conflict errors',
      'a consistent error response format that clients can rely on',
      '429 with Retry-After and 503 and how clients should react',
      'avoid leaking stack traces or internals in errors',
    ],
    advanced: [
      'design an error taxonomy shared across services',
      'partial failures in batch endpoints and how to report them',
      'problem details (RFC 9457) and stable machine-readable codes',
    ],
  },
  'authn-authz': {
    beginner: [
      'authentication versus authorisation',
      'what a session cookie and a token are',
      'why passwords must be hashed',
    ],
    intermediate: [
      'JWT structure, what it proves, and the pitfalls (no revocation, long expiry, storage)',
      'OAuth 2.0 authorisation code flow in plain steps',
      'session versus token authentication trade-offs',
      'role-based versus attribute-based access control',
    ],
    advanced: [
      'refresh token rotation and reuse detection',
      'broken object-level authorisation (IDOR) and how to prevent it systematically',
      'authorisation across microservices: where to enforce and how to propagate identity',
    ],
  },
  'idempotency-retries': {
    beginner: [
      'what idempotent means with an example',
      'why a client may send the same request twice',
    ],
    intermediate: [
      'which HTTP methods are idempotent and why POST is not',
      'idempotency keys for payment-style POST requests',
      'safe retries with backoff and what is unsafe to retry',
      'handle a timeout when the client does not know if the request succeeded',
    ],
    advanced: [
      'implement idempotency storage: key scope, expiry, in-flight requests and response replay',
      'duplicate detection under concurrent identical requests',
      'idempotency across several services in one workflow',
    ],
  },
  'pagination-filtering': {
    beginner: [
      'why an endpoint should not return all records',
      'limit and offset pagination',
    ],
    intermediate: [
      'offset versus cursor pagination and the problem offset has on large or changing data',
      'stable sort order needed for pagination',
      'filtering, sorting and field selection parameters',
    ],
    advanced: [
      'keyset pagination with composite sort keys and tie-breakers',
      'pagination with total counts at scale and their cost',
      'paginate a feed that is constantly changing',
    ],
  },
  versioning: {
    beginner: [
      'why APIs need versions',
      'what a breaking change is versus a non-breaking one',
    ],
    intermediate: [
      'URL versus header versioning trade-offs',
      'make changes backward compatible (add fields, tolerate unknown fields)',
      'deprecation and sunset communication to clients',
    ],
    advanced: [
      'run multiple versions without duplicating the code base',
      'evolve a contract with consumer-driven contract tests',
      'migrate clients off an old version with data on usage',
    ],
  },
  'rate-limiting': {
    beginner: [
      'what rate limiting is and why APIs use it',
      'which response tells a client it is limited',
    ],
    intermediate: [
      'token bucket versus fixed window versus sliding window',
      'limit per user, per IP or per API key and the trade-offs',
      'headers that communicate limits to clients',
    ],
    advanced: [
      'a distributed rate limiter that stays accurate across nodes (Redis, atomic scripts)',
      'protect against bursts and abusive clients without hurting normal users',
      'tiered limits and fairness between tenants',
    ],
  },
  'api-security': {
    beginner: [
      'why use HTTPS for every API call',
      'what input validation protects against',
    ],
    intermediate: [
      'SQL injection and how parameterised queries stop it',
      'CORS: what it does and does not protect',
      'the main OWASP API risks (broken authorisation, excessive data exposure, mass assignment)',
      'secure API keys and secrets',
    ],
    advanced: [
      'mass assignment and over-posting defences',
      'SSRF and how to protect endpoints that fetch URLs',
      'threat model an API: abuse cases, logging and detection',
    ],
  },
  'graphql-grpc': {
    beginner: [
      'what problem GraphQL solves compared with REST',
      'what gRPC is and what Protocol Buffers are',
    ],
    intermediate: [
      'the N+1 problem in GraphQL and batching with dataloaders',
      'when gRPC fits better than REST (internal, streaming, strict contracts)',
      'GraphQL caching and error handling differences',
    ],
    advanced: [
      'protect a GraphQL server from expensive queries (depth, cost limits)',
      'schema evolution without versions in GraphQL and in protobuf',
      'choose between REST, GraphQL and gRPC for a given set of clients',
    ],
  },
};
