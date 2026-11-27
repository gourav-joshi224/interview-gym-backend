import { AnchorMap } from './anchor.types';

export const DSA_ANCHORS: AnchorMap = {
  complexity: {
    beginner: [
      'what time complexity of a single loop versus nested loops, and why',
      'what Big-O means and why constants and lower-order terms are dropped',
      'time versus space complexity of a simple function that builds a new array',
      'why accessing an array element by index is constant time',
    ],
    intermediate: [
      'analyse the complexity of a loop whose variable doubles each step (logarithmic)',
      'amortised cost of appending to a dynamic array that resizes',
      'compare O(n log n) and O(n squared) for a realistic input size',
      'complexity of recursion that makes two calls per level, such as naive Fibonacci',
    ],
    advanced: [
      'derive a recurrence for a divide and conquer algorithm and solve it (master theorem intuition)',
      'trade time for space by choosing a different structure and justify the break-even point',
      'explain why a hash-based solution can be O(1) average yet O(n) worst case',
    ],
  },
  'arrays-strings': {
    beginner: [
      'reverse an array or a string in place and its complexity',
      'check whether a string is a palindrome',
      'find the maximum and second maximum in one pass',
      'why inserting at the front of an array is slow',
    ],
    intermediate: [
      'merge two sorted arrays and describe the approach',
      'rotate an array by k positions without extra space',
      'find the maximum subarray sum (Kadane) and why it works',
      'group anagrams and the cost of the chosen key',
    ],
    advanced: [
      'product of array except self without division in O(n)',
      'trapping rain water: compare the two-pass and two-pointer approaches',
      'longest substring with at most k distinct characters and the invariant that the window maintains',
    ],
  },
  hashing: {
    beginner: [
      'how a hash map finds a value by key and what a collision is',
      'when to use a set instead of a list for membership checks',
      'two sum using a hash map versus nested loops',
      'count the frequency of each element',
    ],
    intermediate: [
      'collision handling: chaining versus open addressing',
      'first non-repeating character and the structure that keeps order',
      'subarray sum equals k using a prefix sum map',
      'design a structure with O(1) insert, delete and random element',
    ],
    advanced: [
      'resizing and load factor: why rehashing is needed and its amortised cost',
      'design an LRU cache with a hash map plus a doubly linked list',
      'what makes a good hash function, and what an adversarial input does to a hash map',
    ],
  },
  'two-pointers-window': {
    beginner: [
      'when two pointers beat nested loops on a sorted array',
      'check whether a pair adds up to a target in a sorted array',
      'remove duplicates from a sorted array in place',
      'what a sliding window is, in plain terms',
    ],
    intermediate: [
      'longest substring without repeating characters and how the window moves',
      'container with most water and why moving the shorter side is safe',
      'three sum and how to avoid duplicate triplets',
      'minimum size subarray with sum at least k',
    ],
    advanced: [
      'minimum window substring and the bookkeeping that keeps it O(n)',
      'sliding window maximum with a monotonic deque',
      'when a window approach fails (negative numbers) and what to use instead',
    ],
  },
  'linked-lists': {
    beginner: [
      'array versus linked list: insertion, access and memory trade-offs',
      'reverse a singly linked list',
      'find the middle node with slow and fast pointers',
      'what the head and tail are and what happens when you delete the head',
    ],
    intermediate: [
      'detect a cycle in a linked list (Floyd) and why the pointers meet',
      'merge two sorted linked lists',
      'remove the nth node from the end in one pass',
      'find the start of a cycle',
    ],
    advanced: [
      'reverse nodes in groups of k and the pointer bookkeeping',
      'copy a list with random pointers in O(1) extra space',
      'LRU cache using a doubly linked list and why a singly linked list is not enough',
    ],
  },
  'stacks-queues': {
    beginner: [
      'stack versus queue: ordering and one real use for each',
      'check balanced brackets with a stack',
      'implement undo or browser back navigation',
      'what push, pop and peek cost',
    ],
    intermediate: [
      'implement a queue using two stacks and the amortised cost',
      'next greater element with a monotonic stack',
      'evaluate a postfix expression',
      'min stack: return the minimum in O(1)',
    ],
    advanced: [
      'largest rectangle in a histogram with a monotonic stack',
      'design a circular buffer and how to tell full from empty',
      'sliding window maximum with a deque and why each element is handled once',
    ],
  },
  'trees-bst': {
    beginner: [
      'what a binary tree and a binary search tree are, and the BST ordering rule',
      'in-order, pre-order and post-order traversal and what in-order gives for a BST',
      'height of a binary tree',
      'search for a value in a BST and its complexity',
    ],
    intermediate: [
      'validate a binary search tree and the common bound mistake',
      'lowest common ancestor in a BST versus a general tree',
      'level order traversal with a queue',
      'why a BST can degrade to O(n) and what balancing fixes',
    ],
    advanced: [
      'serialise and deserialise a binary tree',
      'diameter or maximum path sum and how to combine child results',
      'compare AVL and red-black trees, or a B-tree for disk storage',
    ],
  },
  heaps: {
    beginner: [
      'what a heap is and how it differs from a sorted array',
      'min heap versus max heap and what the root holds',
      'find the k largest elements using a heap',
      'cost of insert and extract-min',
    ],
    intermediate: [
      'kth largest element: heap of size k versus sorting',
      'merge k sorted lists with a heap',
      'top k frequent elements',
      'running median with two heaps',
    ],
    advanced: [
      'why building a heap bottom-up is O(n) and not O(n log n)',
      'task scheduler or meeting rooms using a heap and the greedy reasoning',
      'priority queue with decrease-key for Dijkstra and the cost without it',
    ],
  },
  graphs: {
    beginner: [
      'adjacency list versus adjacency matrix and when to use each',
      'how BFS differs from DFS and the data structure behind each',
      'count connected components in an undirected graph',
      'what a directed graph and a cycle are',
    ],
    intermediate: [
      'number of islands and the traversal choice',
      'shortest path in an unweighted graph with BFS and why it works',
      'detect a cycle in a directed graph',
      'topological sort and when it exists (course schedule)',
    ],
    advanced: [
      'Dijkstra: why it fails with negative edges and what to use instead',
      'union-find with path compression and what it makes possible',
      'minimum spanning tree: Kruskal versus Prim',
    ],
  },
  'recursion-backtracking': {
    beginner: [
      'base case and recursive case using factorial or Fibonacci',
      'what causes a stack overflow in recursion',
      'recursion versus iteration for summing a list',
      'trace the calls of a small recursive function',
    ],
    intermediate: [
      'generate all subsets or permutations and the recursion tree',
      'combination sum and how to avoid duplicate results',
      'generate valid parentheses',
      'why naive recursive Fibonacci is exponential and the fix',
    ],
    advanced: [
      'N-Queens: pruning and how to check conflicts cheaply',
      'word search or Sudoku and how pruning cuts the search',
      'turn a recursion into an explicit stack, and when tail recursion helps',
    ],
  },
  'dynamic-programming': {
    beginner: [
      'what overlapping subproblems means, using Fibonacci',
      'memoisation versus tabulation in one sentence each',
      'climbing stairs and the recurrence it gives',
    ],
    intermediate: [
      'coin change: minimum coins and why greedy can fail',
      'longest increasing subsequence, O(n squared) and the idea of O(n log n)',
      '0/1 knapsack and how to define the state',
      'house robber and how to reduce the space',
    ],
    advanced: [
      'longest common subsequence or edit distance and the table dimensions',
      'optimise a DP from O(n squared) memory to O(n)',
      'how to recognise a DP problem and derive the state, transition and order',
    ],
  },
  'sorting-searching': {
    beginner: [
      'why binary search needs a sorted array and its complexity',
      'bubble, insertion and selection sort at a high level and when each is acceptable',
      'what a stable sort is',
      'merge sort versus quick sort: the main difference',
    ],
    intermediate: [
      'search in a rotated sorted array',
      'find the first and last position of a value with binary search',
      'quick sort pivot choice and the worst case',
      'when counting sort or radix sort beats comparison sorts',
    ],
    advanced: [
      'binary search on the answer (capacity or split array) and the monotonic condition',
      'quickselect and its average versus worst-case behaviour',
      'external merge sort when data does not fit in memory',
    ],
  },
  greedy: {
    beginner: [
      'what a greedy choice is, using coin change with standard coins',
      'why greedy works for some problems and not others',
      'activity selection or meeting rooms at a basic level',
    ],
    intermediate: [
      'interval scheduling: sort by end time and why that is optimal',
      'jump game and the greedy reachability argument',
      'gas station or assign cookies and how to justify the choice',
      'merge overlapping intervals',
    ],
    advanced: [
      'prove a greedy choice correct with an exchange argument',
      'Huffman coding and why the greedy merge is optimal',
      'a problem where greedy fails and the DP alternative',
    ],
  },
};
