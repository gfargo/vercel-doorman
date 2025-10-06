import * as backup from './backup'
import * as diff from './diff'
import * as download from './download'
import * as exportCmd from './export'
import * as init from './init'
import * as list from './list'
import * as setup from './setup'
import * as status from './status'
import * as sync from './sync'
import * as template from './template'
import * as validate from './validate'
import * as watch from './watch'

export const commands = [setup, init, list, status, diff, sync, validate, download, template, backup, exportCmd, watch]
