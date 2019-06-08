import * as CR from 'typings'
import { exec, exists, openFile } from '../node'

const gitOrigin = 'coderoad'

/*
    SINGLE git cherry-pick %COMMIT%
    MULTIPLE git cherry-pick %COMMIT_START%..%COMMIT_END%
    if shell, run shell
*/
export async function gitLoadCommits(actions: CR.TutorialAction): Promise<void> {
  const { commits, commands, files } = actions

  console.log('commits to load', commits)

  for (const commit of commits) {
    const { stdout, stderr } = await exec(`git cherry-pick ${commit}`)
    if (stderr) {
      console.error(stderr)
      throw new Error('Error loading commit')
    }
    console.log('add commit', stdout)
  }

  if (commands) {
    // TODO: run shell as task
    for (const command of commands) {
      const { stdout, stderr } = await exec(command)
      if (stderr) {
        console.error(stderr)

        if (stderr.match(/node-gyp/)) {
          // ignored error
          throw new Error('Error running setup command')
        }
      }
      console.log(`run command: ${command}`, stdout)
    }
  }

  if (files) {
    for (const filePath of files) {
      openFile(filePath)
    }
  }
}

/* 
    save commit
    git commit -am '${level}/${stage}/${step} complete'
*/

export async function gitSaveCommit(position: CR.Position): Promise<void> {
  const { levelId, stageId, stepId } = position
  const { stdout, stderr } = await exec(`git commit -am 'completed ${levelId}/${stageId}/${stepId}'`)
  if (stderr) {
    console.error(stderr)
    throw new Error('Error saving progress to Git')
  }
  console.log('save with commit & continue stdout', stdout)
}

export async function gitClear(): Promise<void> {
  try {
    // commit progress to git
    const { stderr } = await exec('git reset HEAD --hard && git clean -fd')
    if (!stderr) {
      return
    }
    console.error(stderr)
  } catch (error) {
    console.error(error)
  }
  throw new Error('Error cleaning up current unsaved work')
}

export async function gitVersion(): Promise<string | boolean> {
  const { stdout, stderr } = await exec('git --version')
  if (!stderr) {
    const match = stdout.match(/^git version (\d+\.)?(\d+\.)?(\*|\d+)/)
    if (match) {
      // eslint-disable-next-line
      const [_, major, minor, patch] = match
      return `${major}${minor}${patch}`
    }
  }
  throw new Error('Git not installed. Please install Git')
}

async function gitInit(): Promise<void> {
  const { stderr } = await exec('git init')
  if (stderr) {
    throw new Error('Error initializing Gits')
  }
}

export async function gitInitIfNotExists(): Promise<void> {
  const hasGit = await gitVersion()

  if (!hasGit) {
    throw new Error('Git must be installed')
  }

  const hasGitInit = exists('.git')
  if (!hasGitInit) {
    await gitInit()
  }
}

export async function gitAddRemote(repo: string): Promise<void> {
  const { stderr } = await exec(`git remote add ${gitOrigin} ${repo} && git fetch ${gitOrigin}`)
  if (stderr) {
    const alreadyExists = stderr.match(`${gitOrigin} already exists.`)
    const successfulNewBranch = stderr.match('new branch')

    // validate the response is acceptable
    if (!alreadyExists && !successfulNewBranch) {
      console.error(stderr)
      throw new Error('Error adding git remote')
    }
  }
}

export async function gitCheckRemoteExists(): Promise<boolean> {
  try {
    const { stdout, stderr } = await exec('git remote -v')
    if (stderr) {
      return false
    }
    // string match on remote output
    // TODO: improve the specificity of this regex
    return !!stdout.match(gitOrigin)
  } catch (error) {
    console.warn(error)
    return false
  }
}

export async function gitSetupRemote(repo: string): Promise<void> {
  // check coderoad remote not taken
  const hasRemote = await gitCheckRemoteExists()
  // git remote add coderoad tutorial
  // git fetch coderoad
  if (!hasRemote) {
    await gitAddRemote(repo)
  }
}