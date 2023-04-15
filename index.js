const express = require('express')
const {graphqlHTTP} = require('express-graphql')
const {buildSchema} = require('graphql')
const axios = require('axios')

// SWAPI url endpoints
const URL = {
  planets: 'https://swapi.dev/api/planets',
  people: 'https://swapi.dev/api/people',
  starships: 'https://swapi.dev/api/starships'
}

// graphQL schema
const schema = buildSchema(`
  type Planet {
    name: String, 
    diameter: String, 
    climate: String, 
    terrain: String,
    residents: [Person]
  }

  type Person {
    name: String,
    gender: String,
    homeworld: Planet
  }

  type Query {
    planet(id: ID!): Planet
    allPlanets: [Planet]
    person(id: ID!): Person
  }
`)

// graphQL root resolver
const root = {
  planet: async ({id}) => {
    const response = await axios.get(`${URL.planets}/${id}`)
    const data = response.data
    return {
      name: data.name,
      diameter: data.diameter,
      climate: data.climate,
      terrain: data.terrain,
      residents: fetchResources(data.residents, "Person")
    }
  },
  allPlanets: async () => {
    const response = await axios.get(URL.planets)
    const data = response.data
    return data.results
  },
  person: async ({id}) => {
    const response = await axios.get(`${URL.people}/${id}`)
    const data = response.data
    return {
      name: data.name,
      gender: data.gender,
      homeworld: fetchResource(data.homeworld, "Planet")
    }
  }
}

// helper function to fetch url and return response and add a __typename property which is used by some GraphQL clients like Apollo
const fetchResource = async (url, type) => {
  const response = await axios.get(url)
  const data = response.data
  return {
    ...data,
    __typename: type
  }
}

// Same but for an array of urls
const fetchResources = async (urls, type) => {
  const responses = await Promise.all(urls.map((url) => axios.get(url)))
  const data = responses.map((response) => response.data)
  const result = data.map((item) => ({
    ...item,
    __typename: type
  }))
  return result
}

const app = express()

// express middleware to use graphql endpoint, passing in properties of the buildSchema, root resolver and enable grahiql client
app.use('/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true
  })
)

app.listen(3000, () => {
  console.log('Running a GraphQL API server at localhost:3000/graphql');
})

