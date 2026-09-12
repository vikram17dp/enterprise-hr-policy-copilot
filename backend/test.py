from app.rag.embeddings import get_embeddings

embeddings = get_embeddings()

text = "How many casual leaves are employees allowed?"

vector = embeddings.embed_query(text)

print("Embedding dimension:", len(vector))
print("First 10 values:", vector[:10])
