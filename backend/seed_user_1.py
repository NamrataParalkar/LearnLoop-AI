from database import SessionLocal
from models import User, Course, Topic, Concept, LearnerProfile, Mastery

db = SessionLocal()

user = User(id=1, name="Test User", email="test@test.com")
db.merge(user)

course = Course(id=1, title="Algorithms")
db.merge(course)

topic = Topic(id=1, course_id=1, name="Data Structures")
db.merge(topic)
db.commit()

c1 = Concept(id=1, topic_id=1, name="Binary Search Trees")
c2 = Concept(id=2, topic_id=1, name="Dynamic Programming")
c3 = Concept(id=3, topic_id=1, name="Graph Traversal")
db.merge(c1)
db.merge(c2)
db.merge(c3)
db.commit()

profile = LearnerProfile(user_id=1, onboarding_state="active")
db.merge(profile)
db.merge(Mastery(user_id=1, concept_id=1, p_known=0.85, n_observations=12))
db.merge(Mastery(user_id=1, concept_id=2, p_known=0.42, n_observations=6))
db.merge(Mastery(user_id=1, concept_id=3, p_known=0.65, n_observations=8))
db.commit()

print("Seeded successfully for User 1.")
