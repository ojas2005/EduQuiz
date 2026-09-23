from typing import TypedDict
from pydantic import BaseModel, Field, model_validator
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

class Question(BaseModel):
    prompt: str = Field(min_length=5, max_length=1000)
    options: list[str] = Field(min_length=4, max_length=4)
    correct: int = Field(ge=0, le=3)
    skill: str = Field(min_length=1, max_length=100)
    explanation: str = Field(min_length=5, max_length=1000)
class Mission(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    objective: str = Field(max_length=500)
    lesson: str = Field(min_length=30, max_length=6000)
    tasks: list[str] = Field(min_length=2, max_length=5)
    questions: list[Question] = Field(min_length=3, max_length=8)
class Curriculum(BaseModel):
    missions: list[Mission] = Field(min_length=1, max_length=8)
class GenerationState(TypedDict):
    topic: str
    focus: list[str]
    practice: bool
    curriculum: dict

