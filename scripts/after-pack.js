// Grava o ícone do cachorro caramelo e os dados de versão dentro do .exe (sem precisar do Wine/rcedit).
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const ResEdit = require('resedit')
  const PE = require('pe-library')
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exePath = path.join(context.appOutDir, exeName)
  const icoPath = path.join(context.packager.projectDir, 'build', 'icon.ico')

  const exe = PE.NtExecutable.from(fs.readFileSync(exePath))
  const res = PE.NtExecutableResource.from(exe)

  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  const g = groups[0] || { id: 1, lang: 1033 }
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icon.icons.map((i) => i.data))

  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0]
  if (vi) {
    const v = context.packager.appInfo.version
    vi.setFileVersion(...v.split('.').map(Number).concat([0, 0, 0]).slice(0, 3), 0)
    vi.setProductVersion(...v.split('.').map(Number).concat([0, 0, 0]).slice(0, 3), 0)
    vi.setStringValues({ lang: 1033, codepage: 1200 }, {
      ProductName: 'Caramelo Molhado Pet Shop Inc.', FileDescription: 'Caramelo Molhado Pet Shop Inc.',
      CompanyName: 'Caramelo Molhado Pet Shop Inc.', LegalCopyright: 'Caramelo Molhado Pet Shop Inc.', OriginalFilename: exeName, InternalName: 'CarameloMolhado',
    })
    vi.outputToResourceEntries(res.entries)
  }
  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log('  • ícone e informações de versão gravados em', exeName)
}
