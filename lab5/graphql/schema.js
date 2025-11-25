const { gql } = require('apollo-server-express');

const typeDefs = gql`
  scalar DateTime

  type Attachment {
    id: ID!
    filename: String!
    originalName: String!
    path: String!
    uploadedAt: DateTime!
  }

  enum TaskStatus {
    pending
    in_progress
    completed
    cancelled
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    dueDate: String
    createdAt: DateTime!
    updatedAt: DateTime!
    attachments: [Attachment!]!
  }

  type User {
    id: ID!
    login: String!
  }

  type AuthPayload {
    message: String!
    user: User
  }

  type Query {
    me: User
    tasks: [Task!]!
    task(id: ID!): Task
  }

  input TaskInput {
    title: String!
    description: String
    status: TaskStatus!
    dueDate: String
  }

  input TaskUpdateInput {
    title: String
    description: String
    status: TaskStatus
    dueDate: String
  }

  type Mutation {
    register(login: String!, password: String!): AuthPayload!
    login(login: String!, password: String!): AuthPayload!
    logout: AuthPayload!

    createTask(input: TaskInput!): Task!
    updateTask(id: ID!, input: TaskInput!): Task!
    patchTask(id: ID!, input: TaskUpdateInput!): Task!
    deleteTask(id: ID!): Boolean!
  }
`;

module.exports = { typeDefs };


