import requests
import json

API_URL = "http://localhost:8000/api"
COURSE_ID = 1

def run_smoke_test():
    # Provide 3 examples for smoke testing
    in_material = [
        "Summarize the key points of the textbook.",
        "What does the slide on time complexity say?",
        "What did the professor say about binary search?"
    ]
    
    off_material = [
        "Who won the world cup in 2022?",
        "What is the recipe for chocolate chip cookies?",
        "How do I repair a bicycle tire?"
    ]
    
    results = []
    correct_refusals = 0
    false_refusals = 0
    false_answers = 0
    
    print("="*50)
    print("EVALUATION SMOKE TEST")
    print("="*50)
    
    # We use a dummy session_id for all
    for idx, q in enumerate(in_material + off_material):
        is_in = idx < len(in_material)
        resp = requests.post(
            f"{API_URL}/chat", 
            json={"course_id": COURSE_ID, "message": q, "style": "standard"}
        )
        
        if resp.status_code == 200:
            data = resp.json()
            status = data["status"]
            citations = len(data["citations"])
            # Assuming max score is returned (we'll fetch it from DB if needed, but not returned in schema explicitly. We'll skip for smoke).
            
            # Print for each: question, status, number of citations
            print(f"Q: {q}")
            print(f"Status: {status} | Citations: {citations}")
            if citations > 0 and len(results) < 3: # store first 3 examples
                results.append((q, data["answer"], data["citations"]))
            
            if is_in:
                if status == "not_in_material":
                    false_refusals += 1
            else:
                if status == "not_in_material":
                    correct_refusals += 1
                else:
                    false_answers += 1
        else:
            print(f"Failed Q: {q} | Error: {resp.text}")
            
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Correct Refusals (Off-material rejected): {correct_refusals}/{len(off_material)}")
    print(f"False Refusals (In-material rejected): {false_refusals}/{len(in_material)}")
    print(f"False Answers (Off-material answered): {false_answers}/{len(off_material)}")
    
    print("\n" + "="*50)
    print("3 EXAMPLE ANSWERS WITH CITATIONS")
    print("="*50)
    for q, ans, cites in results[:3]:
        print(f"\nQ: {q}")
        print(f"A: {ans}")
        for c in cites:
            print(f"  [{c['chunk_id']}] {c['location']} | {c['excerpt'][:50]}...")

if __name__ == "__main__":
    run_smoke_test()
