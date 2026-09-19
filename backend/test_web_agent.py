from app.rag.workflow import ask


question = "What is the current minimum wage in India?"
#question = "How many annual leave days are employees entitled to?"


result = ask(question)


print("\n================ ANSWER ================\n")
print(result["answer"])


print("\n================ SOURCE ================\n")
print(result["source_used"])


print("\n================ CITATIONS ================\n")

for citation in result["citations"]:
    print(citation)


print("\n================ TRACE ================\n")

for step in result["trace"]:
    print("→", step)