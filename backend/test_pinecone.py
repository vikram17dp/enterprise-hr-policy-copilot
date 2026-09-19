from app.rag.retriever import get_retriever


def main():
    question = "How many annual leave days are employees entitled to?"

    print("\n==============================")
    print("PINECONE RETRIEVAL TEST")
    print("==============================\n")

    print(f"Question: {question}\n")

    retriever = get_retriever()

    documents = retriever.invoke(question)

    print(f"Retrieved {len(documents)} documents\n")

    for i, doc in enumerate(documents, start=1):

        print(f"========== DOCUMENT {i} ==========")

        print("\nCONTENT:")
        print(doc.page_content)

        print("\nMETADATA:")
        print(doc.metadata)

        print()


if __name__ == "__main__":
    main()