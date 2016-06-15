import { SurveyQuestions } from '../survey_questions/survey_questions.js'
import { Assignments } from '../assignments/assignments.js'
import { convertRowToContact } from '../campaign_contacts/parse_csv'
import { chunk, forEach, zip } from 'lodash'
import { batchInsert } from 'meteor/mikowals:batch-insert'
import { CampaignContacts } from '../campaign_contacts/campaign_contacts.js'

export const divideContacts = (contactIds, texters) => {

  const rowCount = contactIds.length
  const texterCount = texters.length

  const chunkSize = Math.max(Math.floor(rowCount / texterCount), 1)

  const chunked = chunk(contactIds, chunkSize)

  if (rowCount > texterCount && rowCount % texterCount > 0) {
    const leftovers = chunked.pop()
    forEach(leftovers, (leftover, index) => chunked[index].push(leftover))
  }

  return zip(texters.slice(0, chunked.length), chunked)
}

export const createAssignment = ({dueBy, campaignId, texterId, texterContactIds }) => {
  const assignmentData = {
    campaignId,
    dueBy,
    userId: texterId,
    createdAt: new Date(),
  }

  const assignmentId = Assignments.insert(assignmentData)
  CampaignContacts.update({ _id: { $in: texterContactIds } }, { $set: { assignmentId } }, { multi: true })
}

export const saveCampaignSurveys = (campaignId, surveys) => {
  for (let survey of surveys) {
    survey.campaignId = campaignId
    SurveyQuestions.insert(survey)
  }
}

export const saveContacts = (campaignId, contacts) => {
  CampaignContacts.remove({ campaignId })

  const data = contacts.map((row) => {
    const contact = convertRowToContact(row)
    contact.campaignId = campaignId
    contact.createdAt = new Date()
    return contact
  })

  CampaignContacts.batchInsert(data)
}

export const assignContacts = (campaignId, dueBy, assignedTexters) => {
  const contacts = CampaignContacts.find({ campaignId, lastMessage: null }, { fields: {} }).fetch()
  const contactIds = _.map(contacts, ({ _id }) => _id )

  const dividedContacts = divideContacts(contactIds, assignedTexters)
  console.log("dividerContacts", dividedContacts)
  forEach(dividedContacts, ( [texterId, texterContactIds] ) => {
    createAssignment({ dueBy, campaignId, texterId, texterContactIds })
  })
}