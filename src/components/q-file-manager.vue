<template>
  <div>
    <q-pull-to-refresh @refresh="refresher">
      <q-input clearable
               clear-icon="mdi-backspace-outline"
               class="q-ma-sm"
               v-model="search"
               type="search"
               debounce="300"
               label="Search in this folder"
               dense
               placeholder="this is a fuzzy search"
      >
        <template v-slot:prepend>
          <q-icon name="mdi-folder-search-outline"/>
        </template>
      </q-input>
      <table class="q-table full-width q-ma-sm" :class="{'highlight striped-odd' : !$global.fm.manager.loading}">
        <thead>
        <tr>
          <th class="text-center checkbox-select non-selectable">
            <q-checkbox dense :value="allSelected" @input="changeSelectAll"/>
          </th>
          <th class="text-left non-selectable"
              :class="{ 'no-pointer-events' : this.search }"
              @click="changeOrder('Name', String)"
          >&nbsp;Name
            <q-icon v-show="!this.search && sorting.field == 'Name'"
                    :class="{'flip-vertical' : sorting.asc}"
                    name="mdi-filter-variant"
            />
          </th>
          <th class="text-right non-selectable"
              :class="{ 'no-pointer-events' : this.search }"
              @click="changeOrder('size', Number)"
          >
            <q-icon v-show="!this.search && sorting.field == 'size'"
                    :class="{'flip-vertical' : sorting.asc}"
                    name="mdi-filter-variant"
            />
            Size
          </th>
          <th class="cursor-pointer text-right desktop-only"
              :class="{ 'no-pointer-events' : this.search }"
              @click="changeOrder('ModTime', Number)"
          >
            <q-icon v-show="!this.search && sorting.field == 'ModTime'"
                    :class="{'flip-vertical' : sorting.asc}"
                    name="mdi-filter-variant"
            />
            Modified
          </th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="$global.fm.manager.loading">
          <td colspan="4" class="text-center">
            <q-spinner-dots size="50px"/>
          </td>
        </tr>
        <tr v-else
            v-for="(item, key) in list"
            :key="key"
            @click="itemClick(key)"
            @dblclick="itemDblClick(key)"
            :class="itemsSelecteds.includes(key) ? selectedClass : 'non-selectable'"
        >
          <td class="checkbox-select">
            <div class="select vertical-middle">
              <q-checkbox dense v-model="itemsSelecteds" size="3rem" :val="key" ref="items"/>
            </div>
            <div class="icons vertical-middle">
              <q-icon class="" :name="item.icon" size="1.7rem"></q-icon>
            </div>
          </td>
          <td class="text-left Name" :title="item.Name">
                      <span class="baseline">
                      <span v-show="item.basename" class="filename" v-text="item.basename"
                      ></span><span class="extension" v-show="item.extension">.{{ item.extension }}</span>
                      </span>
          </td>
          <td class="text-right">{{ item.Size | humanSize }}</td>
          <td class="text-right desktop-only">{{ item.ModTime | humanDate }}</td>
        </tr>
        </tbody>
      </table>
      <div class="row justify-center items-center text-center q-ma-md" v-show="!$global.fm.manager.loading">
        <div class="col-3 text-center self-center">{{ currentList.length }} items</div>
        <div class="col-3 col-md-1 text-center">
          <q-select v-model="internalItemsPerPage"
                    dense
                    hide-bottom-space
                    borderless
                    :options="paginationOptionsSelect"
                    emit-value
                    map-options
          />
        </div>
        <div class="col-md-6 text-center q-mx-sm">
          <q-pagination class="justify-center"
                        v-model="page"
                        :max="totalPages"
                        ellipses
                        :max-pages="$q.platform.is.mobile ? 6 : 8"
          />
        </div>
      </div>
    </q-pull-to-refresh>
    <q-page-sticky position="bottom-left"
                   :offset="[18, 18]"
                   v-show="Object.keys($global.fm.manager.clipboard).length && !$global.fm.manager.loading && !fabulous"
    >
      <q-btn @click="fromClipboard('move')" color="dark" fab class="q-mr-sm">
        <q-icon name="mdi-content-cut"/>
        <q-tooltip anchor="top left" self="bottom left">Move to here</q-tooltip>
      </q-btn>
      <q-btn @click="$global.fm.manager.clipboard = {}" color="white" text-color="dark" fab-mini class="q-mr-sm">
        <q-icon name="mdi-close"/>
        <q-tooltip anchor="top left" self="bottom left">Cancel</q-tooltip>
      </q-btn>
      <q-btn @click="fromClipboard('copy')" color="dark" fab>
        <q-icon name="mdi-content-paste"/>
        <q-tooltip anchor="top left" self="bottom left">Copy to here</q-tooltip>
      </q-btn>
    </q-page-sticky>
    <q-page-sticky v-show="!$global.fm.manager.loading && !fabulous" position="bottom-right" :offset="[55, 18]">
      <q-btn fab color="secondary" @click="refresher()" icon="mdi-reload" class="q-mr-sm"
      >
        <q-tooltip anchor="top left" self="bottom left">Refresh list</q-tooltip>
      </q-btn>
    </q-page-sticky>
    <q-page-sticky v-show="!$global.fm.manager.loading" position="bottom-right" :offset="[18, 18]">
      <q-fab v-model="fabulous"
             color="accent"
             text-color="white"
             active-icon="mdi-close"
             icon="mdi-backburger"
             direction="left"
             class="animate-pop"
      >
        <q-fab-action v-show="itemsSelecteds.length"
                      color="accent"
                      text-color="white"
                      @click="copySelecteds"
                      icon="mdi-content-copy"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[30, 5]">Copy or Move</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="itemsSelecteds.length === 1"
                      color="accent"
                      text-color="white"
                      @click="rename.dialog = true"
                      icon="mdi-cursor-text"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[20, 5]">Rename</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="itemsSelecteds.length === 1 && isTextEditable(selectedPaths[0])"
                      color="accent"
                      text-color="white"
                      @click="editAsCode"
                      icon="mdi-cloud-tags"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[25, 5]">Code editor</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="itemsSelecteds.length" color="negative" @click="confirmDelete" icon="mdi-delete-forever">
          <q-tooltip anchor="top left" self="bottom left" :offset="[20, 5]">Delete</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="!itemsSelecteds.length"
                      color="accent"
                      text-color="white"
                      @click="newFolder.dialog = true"
                      icon="mdi-folder-plus"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[20, 5]">New Folder</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="!itemsSelecteds.length"
                      color="accent"
                      text-color="white"
                      @click="newFile.dialog = true"
                      icon="mdi-file-plus"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[35, 5]">New empty file</q-tooltip>
        </q-fab-action>
        <q-fab-action v-show="!itemsSelecteds.length"
                      color="accent"
                      text-color="white"
                      @click="newUploads"
                      icon="mdi-upload"
        >
          <q-tooltip anchor="top left" self="bottom left" :offset="[20, 5]">Upload file</q-tooltip>
        </q-fab-action>
      </q-fab>
    </q-page-sticky>

    <q-dialog v-model="editor.open" maximized persistent>
      <q-layout v-if="editor.open">
        <q-header class="bg-primary">

          <q-toolbar>
            <q-btn flat @click="editorClose">
              <q-icon name="mdi-chevron-left"/>
            </q-btn>
            <q-toolbar-title>
              /{{ editor.path }}
            </q-toolbar-title>
            <span>
                        <q-toggle v-model="editor.autosave"
                                  :color="editor.saving ? 'warning' : 'positive'"
                                  unchecked-icon="mdi-auto-upload"
                                  :checked-icon="editor.saving ? 'mdi-cloud-upload' : 'mdi-spellcheck'"
                                  @click="editorAutosave"
                        />
                    <q-tooltip>Autosave</q-tooltip>
                    </span>
            <q-btn flat
                   :disabled="!editorFileModified || editor.saving"
                   loader
                   @click="(e, done) => { saveEdits(done) }"
                   :color="editor.saving ? 'warning' : 'white'"
                   v-show="!editor.autosave"
            >
              <q-icon v-if="editor.saving" title="Saving" name="mdi-cloud-upload"/>
              <q-icon v-else-if="editorFileModified" title="Save" name="mdi-content-save"/>
              <q-icon v-else title="Saved!" name="mdi-check-all"/>
            </q-btn>
          </q-toolbar>
        </q-header>

        <q-footer>
          <q-select dark
                    style="margin-top: 0; margin-bottom: 0;"
                    :options="editor.themeOptions"
                    v-model="editor.theme"
                    emit-value
                    map-options
          />
        </q-footer>

        <q-page-container style="padding-bottom: 0">
          <q-page>
            <editor v-model="editor.code"
                    :file="selectedPaths[0]"
                    :mime="editor.mime"
                    :theme="editor.theme"
                    @blur="editorAutosave"
            ></editor>
          </q-page>
        </q-page-container>

      </q-layout>
    </q-dialog>
    <q-dialog v-model="rename.dialog"
              persistent
              @before-show="rename.oldName = selectedPaths[ 0 ].Name"
              @show="rename.newName = rename.oldName"
    >
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Rename</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense placeholder="new filename" v-model="rename.newName" autofocus @keyup.enter="renameItem"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" @click="rename.dialog = false"/>
          <q-btn flat label="Rename" @click="renameItem"/>
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="newFile.dialog" persistent @before-show="newFile.newName = ''"
    >
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">New file</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense placeholder="filename.ext" v-model="newFile.newName" autofocus @keyup.enter="newFileItem"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" @click="newFile.dialog = false"/>
          <q-btn flat label="Create" @click="newFileItem"/>
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="newFolder.dialog" persistent @before-show="newFolder.newName = ''"
    >
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">New folder</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense placeholder="directory name" v-model="newFolder.newName" autofocus @keyup.enter="newFolderItem"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" @click="newFolder.dialog = false"/>
          <q-btn flat label="Create" @click="newFolderItem"/>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import md5              from "blueimp-md5"
import { date, format } from "quasar"
import editor           from "src/components/ide/editor"
import Vue              from "vue"
import VueFuse          from "vue-fuse"

Vue.use(VueFuse)

const {humanStorageSize} = format
export default {
  components: {
    editor,
  },
  props:      {
    table:             {
      type:     Array,
      required: true,
      default:  () => this.$global.fm.manager.table,
    },
    baseId:            {
      type:     String,
      required: true,
    },
    paginationOptions: {
      type:    Array,
      default: () => [ 5, 10, 30, 100, 500, 1000 ],
    },
    itemsPerPage:      {
      type:    Number,
      default: 30,
    },
  },
  mounted() {
    window.onbeforeunload = () => this.windowClose()
    this.listStorages() // Just to update $global.fm.storages
    this.$q.notify('Click selects, Double opens')
  },
  data() {
    return {
      rename:               {
        dialog:  false,
        newName: '',
        oldName: '',
      },
      newFile:              {
        dialog:  false,
        newName: '',
      },
      newFolder:            {
        dialog:  false,
        newName: '',
      },
      fabulous:             false,
      internalItemsPerPage: this.itemsPerPage,
      itemsSelecteds:       [],
      selectedClass:        "bg-grey text-white non-selectable",
      search:               "",
      results:              [],
      page:                 1,
      searchOptions:        {
        keys:       [ "Name" ],
        defaultAll: true,
      },
      sorting:              {
        field: "Name",
        asc:   true,
        type:  String,
      },
      editor:               {
        open:         false,
        path:         "",
        code:         "",
        saving:       false,
        savedCode:    "",
        mime:         "text/plain",
        autosave:     false,
        theme:        "monokai",
        themeOptions: [
          {label: "Dark: Material", value: "material"},
          {label: "Dark: Monokai", value: "monokai"},
          {label: "Light: Elegant", value: "elegant"},
          {label: "Light: Neat", value: "neat"},
        ],
      },
    }
  },
  computed: {
    allSelected() {
      return this.itemsSelecteds.length === this.list.length
    },
    selectedPaths() {
      return this.itemsSelecteds.map(i => this.list[ i ])
    },
    onlyFilesSelected() {
      return this.selectedPaths.every(i => !i.IsDir)
    },
    list() {
      const itemsPerPage = parseInt(this.internalItemsPerPage)
      const start        = (this.page - 1) * itemsPerPage
      const end          = start + itemsPerPage

      let partialList = this.currentList.slice(start, end)

      return partialList.map(x => {
        x.extension = String(x.IsDir ? '' : x.Name.split(".").pop())
        x.basename  = String(x.IsDir ? x.Name : (x.Name.split('.').slice(0, -1)).join('.'))
        x.icon      = this.icon(x)
        return x
      })
    },
    totalPages() {
      return Math.ceil(this.currentList.length / this.internalItemsPerPage)
    },
    currentPath() {
      return this.$route.params.path || ""
    },
    currentList() {
      // Useful for totalPages
      let final
      if (this.search) {
        final = this.results
      }
      else {
        let r = this.table

        r.sort(this.compare)
        const folders = r.filter(item => item.IsDir)
        const files   = r.filter(item => !item.IsDir)

        r = folders.concat(files)

        final = this.sorting.asc ? r : r.reverse()
      }

      return final
    },
    paginationOptionsSelect() {
      let x = this.paginationOptions.map(x => ({
        label: x.toString(),
        value: x,
      }))
      x.unshift({label: "All", value: 100000})
      return x
    },
    editorFileModified() {
      return this.editor.code !== this.editor.savedCode
    },
  },
  filters:  {
    humanSize: v => humanStorageSize(parseInt(v)),
    humanDate: v => !!v ? date.formatDate(parseInt(v) * 1000, "DD MMM YYYY HH:mm") : '--',
  },
  watch:    {
    table() {
      this.page           = 1
      this.itemsSelecteds = []
      this.search         = ""
    },
    search(new_search) {
      this.page           = 1
      this.itemsSelecteds = []

      this.$search(new_search, this.table, this.searchOptions)
          .then(results => this.results = results)
    },
    itemsSelecteds(n) {
      if (n.length == 1) {
        this.fabulous = true
      }
      else if (!n.length) {
        this.fabulous = false
      }
    },
  },
  methods:  {
    newUploads() {
      const path   = this.currentPath
      const baseId = this.baseId
      const uid    = md5(baseId + path)

      this.$global.fm.uploads.lastUid = uid

      const existsInUploads = this.$global.fm.uploads.groups.find(el => el.uid === uid)

      if (!existsInUploads) {
        this.$global.fm.uploads.groups.unshift({uid, baseId, path})
      }

      this.$global.globalRefs.modals.fileUploadModal = true
    },
    openCodeEditor(obj) {
      this.editor.path      = obj.path
      this.editor.code      = obj.read
      this.editor.savedCode = obj.read
      this.editor.mime      = obj.mime
      this.editor.open      = true
    },
    editAsCode() {
      this.viewFile(this.baseId, {item: this.selectedPaths[ 0 ], path: this.currentPath}, this.openCodeEditor)
    },
    saveEdits(done = () => {}) {
      if (this.editorFileModified) {
        this.saveFile(
          this.baseId,
          "/" + this.editor.path,
          this.editor.code,
          done,
        )
      }
      else {
        done()
      }
    },
    editorAutosave() {
      if (this.editor.autosave) {
        this.saveEdits()
      }
    },
    editorClose() {
      if (!this.editorFileModified) {
        this.editor.open = false
      }
      else {
        if (confirm("Leave without saving changes?")) {
          this.editor.open = false
        }
      }
    },
    windowClose() {
      if (this.editorFileModified) {
        return "Leave without saving changes?"
      }
    },
    refresher(done = () => {}) {
      done() // We already have a loader
      this.$emit("refresh")
    },
    confirmDelete() {
      let items = this.selectedPaths.length > 1 ? this.selectedPaths.length + ' items' : this.selectedPaths[ 0 ].filename
      this.$q.notify({
                       message: `Delete ${ items }?`,
                       caption: "Can't be undone",
                       icon:    "mdi-delete-forever",
                       type:    'negative',
                       timeout: 20000,
                       actions: [ {
                         label:   "Delete",
                         color:   'white',
                         handler: () => {
                           this.deleteFiles(this.baseId, {path: this.currentPath}, this.selectedPaths)
                         },
                       } ],
                     })
    },
    copySelecteds() {
      this.toClipboard({originId: this.baseId, paths: this.selectedPaths})
      this.$q.notify({
                       message: "Now go to other folder/cloud!",
                       type:    'info',
                       icon:    'mdi-content-copy',
                     })
      this.changeSelectAll()
    },
    newFolderItem() {
      this.newFolder.dialog = false
      this.createDir(this.baseId, this.currentPath, this.newFolder.newName)
    },
    newFileItem() {
      this.newFile.dialog = false
      this.createFile(this.baseId, this.currentPath, this.newFile.newName)
    },
    renameItem() {
      this.rename.dialog = false
      this.renameDoc(this.baseId, this.selectedPaths[ 0 ], this.rename.newName)
    },
    changeSelectAll() {
      const all = Object.keys(this.list).map(x => parseInt(x))

      if (this.itemsSelecteds.length) {
        this.itemsSelecteds = []
      }
      else {
        this.itemsSelecteds = [ ...Array(this.list.length).keys() ]
      }
    },
    itemClick(i) {
      this.$refs.items[ i ].$el.click()
    },
    itemDblClick(i) {

      const item = this.list[ i ]
      if (item.IsDir) {
        const query = {}
        if (!!item.ID) { // For Google Drive
          query.gdrive = item.ID
        }
        this.$router.push({path: `/fm/${ this.baseId }/${ this.currentPath }/${ item.Path }`, query})
      }
      else {
        alert(`Oh, use the menu for now. ${ item.Name }`)
        // this.$refs.items[ i ].$el.click()
      }
    },
    changeOrder(field, type = String) {
      if (!this.search) {
        if (this.sorting.field == field) {
          // Same field
          this.sorting.asc = !this.sorting.asc
        }
        else {
          // New field
          this.sorting.field = field
          this.sorting.asc   = true
        }

        this.sorting.type = type
      }
    },
    compare(a, b) {
      if (this.sorting.type === String) {
        return this.compareString(a, b)
      }
      else {
        // Number
        return this.compareNumber(a, b)
      }
    },
    compareNumber(a, b) {
      return a[ this.sorting.field ] - b[ this.sorting.field ]
    },
    compareString(a, b) {
      const nameA = a[ this.sorting.field ].toUpperCase() // ignore upper and lowercase
      const nameB = b[ this.sorting.field ].toUpperCase() // ignore upper and lowercase
      if (nameA < nameB) {
        return -1
      }
      if (nameA > nameB) {
        return 1
      }

      // names must be equal
      return 0
    },
    icon(item) {
      const icon_file = this.icons_table[ String(item.extension).toLowerCase() ]

      return item.IsDir ? "mdi-folder" : icon_file ? icon_file : item.Name.charAt(0) === "." ? "mdi-file-hidden" : "mdi-file-outline"

    },
  },
}
</script>

<style lang="scss">
.q-table {
  th {
    // background-color $light
  }

  tr {
    &:nth-child(odd) {
    }

    &:nth-child(even) {
      background: $grey-3;
    }

    td, th {
      font-size: 1rem;
    }

    .baseline {
      display: inline-flex;
    }

    .filename {
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50vw;
    }

    .extension {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    }

    .checkbox-select {
      max-width: 45px;
      min-width: 25px;
      padding: 0;
      text-align: center;
    }

    .select {
      display: none;
    }

    .Name {
      padding-left: 0;
      padding-right: 0
    }

    &:hover {
      cursor: pointer;

      .icons {
        display: none;
      }

      .select {
        display: inline-flex;
      }
    }
  }
}
</style>
