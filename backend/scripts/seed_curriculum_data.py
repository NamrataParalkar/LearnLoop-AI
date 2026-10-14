from database import SessionLocal
import models

def seed_curriculum():
    db = SessionLocal()
    print("Seeding rich curriculum for existing courses...")

    curriculum_data = {
        1: [
            {
                "title": "Module 1: Algorithmic Complexity & Foundations",
                "description": "Asymptotic analysis, Big-O notation, master theorem, and recurrence relations.",
                "display_order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1.1: Asymptotic Bounds & Recurrence Relations",
                        "description": "Formal definitions of Big-O, Big-Omega, Big-Theta, and recurrence trees.",
                        "content_text": "Understanding asymptotic bounds allows us to classify algorithms by how their resource requirements scale with input size. In this lesson, we break down Big-O worst-case bounds, Omega lower bounds, and Theta tight bounds with proof techniques.",
                        "video_url": "https://www.youtube.com/watch?v=4nSI0by9-lg",
                        "duration_minutes": 20,
                        "display_order": 1,
                        "is_preview": True,
                        "is_published": True
                    },
                    {
                        "title": "Lesson 1.2: Divide and Conquer Paradigms",
                        "description": "Analyzing Merge Sort and Quick Sort with partition strategies.",
                        "content_text": "Divide and conquer divides the problem into smaller subproblems, solves them recursively, and combines their solutions. Merge sort achieves an optimal O(n log n) comparison-based sorting bound.",
                        "duration_minutes": 25,
                        "display_order": 2,
                        "is_preview": True,
                        "is_published": True
                    }
                ]
            },
            {
                "title": "Module 2: Balanced Trees & Graph Search",
                "description": "AVL trees, Red-Black invariants, Dijkstra, and Bellman-Ford shortest paths.",
                "display_order": 2,
                "lessons": [
                    {
                        "title": "Lesson 2.1: Binary Search Trees & Invariant Properties",
                        "description": "BST insertion, deletion with in-order predecessor replacement, and rotations.",
                        "content_text": "A Binary Search Tree guarantees that for every node X, all values in its left subtree are less than X and all values in its right subtree are greater than X. We analyze rebalancing rotations to guarantee O(log n) worst-case time.",
                        "duration_minutes": 30,
                        "display_order": 1,
                        "is_preview": False,
                        "is_published": True
                    },
                    {
                        "title": "Lesson 2.2: Breadth-First & Depth-First Graph Traversals",
                        "description": "Queue-based BFS, recursion stack DFS, cycle detection, and topological sorting.",
                        "content_text": "Graph search forms the backbone of routing, dependency resolution, and network flow algorithms. We cover adjacency list representations, edge classification, and connected component discovery.",
                        "duration_minutes": 35,
                        "display_order": 2,
                        "is_preview": False,
                        "is_published": True
                    }
                ]
            },
            {
                "title": "Module 3: Dynamic Programming & Optimal Substructure",
                "description": "Memoization vs. bottom-up tabulation, knapsack, and sequence alignment.",
                "display_order": 3,
                "lessons": [
                    {
                        "title": "Lesson 3.1: Optimal Substructure & Overlapping Subproblems",
                        "description": "Identifying when greedy fails and dynamic programming provides guaranteed optimality.",
                        "content_text": "Dynamic Programming applies to problems with optimal substructure and overlapping subproblems. We demonstrate state transition formulation using Fibonacci, Rod Cutting, and 0/1 Knapsack.",
                        "duration_minutes": 40,
                        "display_order": 1,
                        "is_preview": False,
                        "is_published": True
                    }
                ]
            }
        ],
        2: [
            {
                "title": "Module 1: Deep Learning Foundations & Neural Calculus",
                "description": "Computational graphs, forward and backward propagation, tensor operations.",
                "display_order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1.1: Gradient Descent & Loss Landscapes",
                        "description": "Vector calculus, Jacobians, Hessians, and learning rate schedules.",
                        "content_text": "Neural network optimization is governed by high-dimensional non-convex optimization. We analyze SGD, Adam, learning rate warmup, and vanishing gradients.",
                        "video_url": "https://www.youtube.com/watch?v=aircAruvnKk",
                        "duration_minutes": 25,
                        "display_order": 1,
                        "is_preview": True,
                        "is_published": True
                    },
                    {
                        "title": "Lesson 1.2: Modern Transformer & Attention Architectures",
                        "description": "Scaled dot-product attention, multi-head projections, and positional encodings.",
                        "content_text": "Transformers revolutionized sequence processing by replacing recurrence with parallel self-attention. We study query, key, and value matrices and causal masking.",
                        "duration_minutes": 35,
                        "display_order": 2,
                        "is_preview": True,
                        "is_published": True
                    }
                ]
            }
        ],
        3: [
            {
                "title": "Module 1: Distributed Consensus & Fault Tolerance",
                "description": "CAP theorem, Paxos consensus, and Raft leader election.",
                "display_order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1.1: Raft Replicated State Machines",
                        "description": "Log replication, split votes, safety invariants, and term mechanics.",
                        "content_text": "Raft decomposes consensus into leader election, log replication, and safety. Each node operates as a follower, candidate, or leader in a state machine approach.",
                        "duration_minutes": 30,
                        "display_order": 1,
                        "is_preview": True,
                        "is_published": True
                    }
                ]
            }
        ],
        4: [
            {
                "title": "Module 1: React Server Components & Next.js App Router",
                "description": "Streaming SSR, Partial Prerendering, and reactive client boundaries.",
                "display_order": 1,
                "lessons": [
                    {
                        "title": "Lesson 1.1: Server vs Client Component Architecture",
                        "description": "RSC wire format, bundle reduction, and async data fetching patterns.",
                        "content_text": "React Server Components execute strictly on the server and emit serialized UI trees without bundling runtime JavaScript into the browser payload.",
                        "duration_minutes": 20,
                        "display_order": 1,
                        "is_preview": True,
                        "is_published": True
                    }
                ]
            }
        ]
    }

    for cid, modules in curriculum_data.items():
        course = db.query(models.Course).filter(models.Course.id == cid).first()
        if not course:
            continue

        for m_data in modules:
            existing_mod = db.query(models.CourseModule).filter(
                models.CourseModule.course_id == cid,
                models.CourseModule.title == m_data["title"]
            ).first()

            if not existing_mod:
                existing_mod = models.CourseModule(
                    course_id=cid,
                    title=m_data["title"],
                    description=m_data["description"],
                    display_order=m_data["display_order"]
                )
                db.add(existing_mod)
                db.commit()
                db.refresh(existing_mod)

            for l_data in m_data["lessons"]:
                existing_les = db.query(models.Lesson).filter(
                    models.Lesson.module_id == existing_mod.id,
                    models.Lesson.title == l_data["title"]
                ).first()

                if not existing_les:
                    new_les = models.Lesson(
                        module_id=existing_mod.id,
                        course_id=cid,
                        title=l_data["title"],
                        description=l_data["description"],
                        content_text=l_data["content_text"],
                        video_url=l_data.get("video_url"),
                        duration_minutes=l_data["duration_minutes"],
                        display_order=l_data["display_order"],
                        is_preview=l_data["is_preview"],
                        is_published=l_data["is_published"]
                    )
                    db.add(new_les)
        db.commit()

    print("Curriculum successfully populated for existing courses!")
    db.close()

if __name__ == "__main__":
    seed_curriculum()
