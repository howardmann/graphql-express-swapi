const express = require('express')
const {graphqlHTTP} = require('express-graphql')
const {buildSchema} = require('graphql')
const axios = require('axios')

// SWAPI REST API endpoints
const URL = {
  planets: 'https://swapi.dev/api/planets',
  people: 'https://swapi.dev/api/people',
  starships: 'https://swapi.dev/api/starships'
}

// GraphQL schema
// type <Resource>: resources and properties we want to expose via GraphQL including their relatonships
// type <Query>: query params and dynamic properties passed to access Resource
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

// GraphQL root resolver
// type <Query> properties map to root object passing in dyanmic properties and resolves to type <Resource>
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
  // fetch allPlanets and associated residents and map them to Person schema
  allPlanets: async () => {
    const response = await axios.get(URL.planets)
    const data = response.data.results
    const planets = await Promise.all(data.map(async (planet) => {
      const residents = await fetchResources(planet.residents, 'Person')
      return {
        name: planet.name,
        diameter: planet.diameter,
        climate: planet.climate,
        terrain: planet.terrain,
        residents
      }
    }))
    return planets
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

// Helper function when we need to fetch a related resource
// fetch url and return response and add a __typename property which is used by some GraphQL clients like Apollo
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

