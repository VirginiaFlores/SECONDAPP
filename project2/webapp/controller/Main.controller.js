sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Token",
    "sap/ui/model/Filter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/Sorter",
    "sap/ui/core/util/Export",
    "sap/ui/core/util/ExportTypeCSV"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Token, Filter, MessageBox, MessageToast, DateFormat, Sorter, Export, ExportTypeCSV) {
        "use strict";

        return Controller.extend("ns.project2.controller.Main", {

            // OData service models
            mainServiceModel: "mainServiceModel",

            // Data models
            mainModel: "mainModel",
            typeCodeModel: "TypeCodeModel",
            supplierModel: "SupplierModel",
            colsP13nModel: "ColsP13nModel",

            // Odata entities
            mainEntity: "ProductSet",

            // Fragments
            sortMainTable: "sortMainTable",
            columnsSelectionDialog: "columnsSelectionDialog",

            //Global variables	 
            defaultMainTableCols: ["colProductID", "colTypeCode", "colCategory", "colName"],
            filterBarMultiInputs: [],

            /**
            * Errors management function.
            */
            manageErrors: function (genericMessage, error, useMessageToast) {

                let errorCode = error.statusCode;
                let resourceBundle = this.getView().getModel("i18n").getResourceBundle();

                switch (errorCode) {

                    case 403:
                        MessageBox.error(genericMessage, {
                            title: resourceBundle.getText("insufficientPermissions")
                        });
                        break;

                    case 401:
                        MessageBox.error(resourceBundle.getText("sessionExpired"));
                        break;

                    default:
                        if (useMessageToast) {
                            MessageToast.show(genericMessage);
                        } else {
                            MessageBox.error(genericMessage);
                        }
                        break;
                }
            },

            onInit: function () {

                // All filter multiInputs are stored inside this variable to ease it's access.
                this.filterBarMultiInputs = [
                    this.getView().byId("ProductID_MI")
                ];

                this.filterMultiComboBoxes = [
                    this.getView().byId("SupplierId_CB")  
                ];

                this.filterSelect = [
                    this.getView().byId("typeCodeId_SL")
                ];

                this.filterDateRangeSelector = [
                    this.getView().byId("dateSelectorId")
                ];

                if (this.getView().getModel(this.mainModel) === undefined) {
                    this.getView().byId("butSort").setEnabled(false);
                    this.getView().byId("butExport").setEnabled(false);
                    this.getView().byId("butSelectColumns").setEnabled(false);
                }                    

                this._setMultiInputValidators();
                this._getUserColumns();
                this._loadDataHelpSearch();    
            },

            /**
            * Data collection for loading search helps
            */
            _loadDataHelpSearch: function () {
                this._typeCodeHelpSearch();
                this._supplierHelpSearch();
            },

            /**
            * Validators are added to all multiInputs so the user can create tokens pressing "enter" after entering a value.
            */
            _setMultiInputValidators: function () {

                let validatorFunction = function (args) {
                    let text = args.text;
                    if (!text) {
                        return "";
                    } else {
                        return new Token({
                            key: text,
                            text: text
                        });
                    }
                };
                // Loops assigning the validator function.
                for (let tokens of this.filterBarMultiInputs) {
                    tokens.addValidator(validatorFunction);
                }
            },

            /**
            * All filters are cleared. 
            * @param {object} oEvent event
            */
            onClearFilters: function (oEvent) {

                for (let multiImput of this.filterBarMultiInputs) {
                    multiImput.removeAllTokens();
                    multiImput.setValue();
                }

                for (let multiCombo of this.filterMultiComboBoxes) {
                    multiCombo.setSelectedKeys([]);
                }

                for (let multiSelect of this.filterSelect) {
                    multiSelect.setSelectedKey("");
                }

                for (let rangeDateSelector of this.filterDateRangeSelector) {
                    rangeDateSelector.setValue();
                }
            },

            /**
             * Search event called when user press the filter button.
             * @param {object} oEvent event
             */
            onFilter: function (oEvent) {

                let filters = [];
                
                filters =  this._getMultiInputFilters(filters);
                filters =  this._getMultiComboFilters(filters);
                filters =  this._getMultiSelectFilters(filters);
                filters =  this._getDateRangeSelectionFilters(filters);       

                this._readDataFromFilters(filters);

            },
            /*
            * For each multiInput, tokens are retrieved and converted into filters. Then each array of filters is added
            * to another filter that will work as a logic "OR". Filter parameters (database field corresponding to each filter)
            * are obtained from the "customData" aggregation, defined inside the fragment and found in each MultiInput.
            */
            _getMultiInputFilters: function (filters) {

                for (let mi of this.filterBarMultiInputs) {
                    let tokens = mi.getTokens();

                    // There's only one customData that stores the corresponding database field for each MultiInput.
                    let filterParam = mi.getCustomData()[0].getValue();

                    if (!filterParam) continue;

                    let tokenFilters = this._getFiltersByTokens(tokens, filterParam);

                    if (tokenFilters.length > 0) {

                        filters.push(new Filter({
                            filters: tokenFilters,
                            and: false
                        }));
                    }
                }
                return filters;
            },

            /* For each multiCombo, tokens are retrieved and converted into filters. 
            * Then each array of filters is added to another filter that will work as a logic "OR". 
            */
            _getMultiComboFilters: function (filters) {

                for (let mc of this.filterMultiComboBoxes) {
                    let tokens = mc.getSelectedItems();
                    // There's only one customData that stores the corresponding database field for each MultiInput.
                    let filterParam = mc.getCustomData()[0].getValue();

                    if (!filterParam) {
                        continue;
                    }

                    let tokenFilters = this._getFiltersByTokens(tokens, filterParam);
                    if (tokenFilters.length > 0) {
                        filters.push(new Filter({
                            filters: tokenFilters,
                            and: false
                        }));
                    }
                }
                return filters;
            },

            /* For each select, tokens are retrieved and converted into filters. */
            _getMultiSelectFilters: function (filters) {

                for (let ms of this.filterSelect) {
                    let tokens = ms.getSelectedKey(); 
                    if (tokens.length > 0) {                   
                        filters.push(new Filter("TypeCode", sap.ui.model.FilterOperator.EQ, tokens));
                    }
                }
                return filters;
            },

            /* Date range filter */
            _getDateRangeSelectionFilters: function (filters) {

                for (let dr of this.filterDateRangeSelector) {
                    let initialDate = dr.getDateValue();
                    let secondDate = dr.getSecondDateValue();
                    let createDateFilterParam = dr.getCustomData()[0].getValue();
                    let dateFilters = [];

                    let oDateFormat = DateFormat.getDateTimeInstance({
                        pattern: "yyyy-MM-ddTHH:mm:ss"
                    });

                    if (initialDate) {
                        initialDate = oDateFormat.format(new Date(initialDate));
                        dateFilters.push(new Filter(createDateFilterParam, sap.ui.model.FilterOperator.GE, initialDate));
                    }

                    if (secondDate) {
                        secondDate = oDateFormat.format(new Date(secondDate));
                        dateFilters.push(new Filter(createDateFilterParam, sap.ui.model.FilterOperator.LE, secondDate));
                    }

                    if (dateFilters.length > 0) {
                        filters.push(new Filter({
                            filters: dateFilters,
                            and: true
                        }));
                    }
                }    
                return filters;
            },

            /**
            * A filter is created for each token with the parameter associated to the database.
            * @param {array} tokens Array of token objects.
            * @param {string} filterParam string representing the database field to filter with.
            * @return {array} Array of filter objects
            */
            _getFiltersByTokens: function (tokens, filterParam) {

                let filters = [];

                for (let tk of tokens) {
                    filters.push(new Filter(filterParam, sap.ui.model.FilterOperator.EQ, tk.getKey()));
                }

                return filters;
            },

            /**
            * Retrieve information from backend OData using filters.
            * @param {array} filters Array of filters.
            */
            _readDataFromFilters: function (filters) {
                let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
                let serviceModel;
                let that = this;

                serviceModel = this.getView().getModel(this.mainServiceModel);

                let successFunction = function (oData, result) {
                    that.getView().getModel(that.mainModel).setData(oData);
                    if (oData.results.length !== 0) {
                        that.getView().byId("butSort").setEnabled(true);
                        that.getView().byId("butExport").setEnabled(true);
                        that.getView().byId("butSelectColumns").setEnabled(true);
                    }                 
                    that.getView().setBusy(false);
                };

                let errorFunction = function (error) {
                    that.manageErrors(resourceBundle.getText("readDataError"), error);
                    that.getView().setBusy(false);
                };

                this.getView().setBusy(true);
                serviceModel.read("/" + this.mainEntity, {
                    filters: filters,
                    and: true,
                    async: true,
                    success: successFunction,
                    error: errorFunction
                });

            },

            /**
            * Retrieve information from backend OData using filters.
            * @param {array} filters Array of filters.
            */
            _typeCodeHelpSearch: function () {
                let resourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                let serviceModel;
                let that = this;

                serviceModel = this.getOwnerComponent().getModel(this.mainServiceModel);

                let successFunction = function (oData) {
                    let results = oData.results;
                    let deleteDuplicatesTC = that.removeDuplicatesTC(results);
                    
                    that.getView().getModel(that.typeCodeModel).setData(deleteDuplicatesTC);               
                    that.getView().setBusy(false);
                };

                let errorFunction = function (error) {
                    that.manageErrors(resourceBundle.getText("readDataError"), error);
                    that.getView().setBusy(false);
                };

                this.getView().setBusy(true);
                serviceModel.read("/" + this.mainEntity, {
                    and: true,
                    async: true,
                    urlParameters: {
                        $select: "TypeCode"
                    },
                    success: successFunction,
                    error: errorFunction
                });
            },

            /**
            * Retrieve information from backend OData using filters.
            * @param {array} filters Array of filters.
            */
            _supplierHelpSearch: function () {
                let resourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                let serviceModel;
                let that = this;

                serviceModel = this.getOwnerComponent().getModel(this.mainServiceModel);

                let successFunction = function (oData) {
                    let results = oData.results;      
                    let deleteDuplicatesSP = that.removeDuplicatesSP(results);
                    
                    that.getView().getModel(that.supplierModel).setData(deleteDuplicatesSP);               
                    that.getView().setBusy(false);
                };

                let errorFunction = function (error) {
                    that.manageErrors(resourceBundle.getText("readDataError"), error);
                    that.getView().setBusy(false);
                };

                this.getView().setBusy(true);
                serviceModel.read("/" + this.mainEntity, {
                    and: true,
                    async: true,
                    urlParameters: {
                        $select: "SupplierID, SupplierName"
                    },
                    success: successFunction,
                    error: errorFunction
                });
            },

            /**
            * Removes duplicate records from information received from OData
            * @param {array} arrayIn Array of values received from OData.
            */
            removeDuplicatesTC: function (arrayIn) {
                let arrayOut = [];
                let exist = false;

                for (let tc of arrayIn) {       
                    if (arrayOut.length !== 0) {
                        for (let tca of arrayOut) {
                            exist = false;
                            if (tc.TypeCode === tca.TypeCode) {
                                exist = true;                     
                            }
                            if (exist === false) {
                                arrayOut.push(tc);
                            }
                        }
                                             
                    } else {
                        arrayOut.push(tc);
                    }
                }
                arrayOut.push("");

                return arrayOut;
            },

            /**
            * Removes duplicate records from information received from OData
            * @param {array} arrayIn Array of values received from OData.
            */
            removeDuplicatesSP: function (arrayIn) {
                let arrayOut = [];

                for (let sp of arrayIn) {
                    
                    if (!arrayOut.includes(sp.SupplierID)) {
                        arrayOut.push(sp);                    
                    }        
                }
                return arrayOut;
            },

            /**
            * Sort button press event. 
            */
            onSortButtonPressed: function () {
                let sortFragment = this._getFragment(this.sortMainTable);
                sortFragment.open();
            },

            /*
            * This functions searches if the fragment with the corresponding name is already created. If it's not, then it creates it
            * with the name "<fragmentName>_fragment".
            * 
            * @param {string} fragmentName String representing the name of the fragment's file.
            * @param {object} source Source context where that fragment should depend on (if NULL it will depend on the current view). 
            * @return {object} Fragment with the given name.
            */
            _getFragment: function (fragmentName, source) {

                if (!this[fragmentName + "_fragment"]) {
                    this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                        this);
                }

                if (source) {
                    try {
                        source.addDependent(this[fragmentName + "_fragment"]); // genera una excepción
                    } catch (err) {
                        // sentencias para manejar cualquier excepción
                        this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                            this);
                        source.addDependent(this[fragmentName + "_fragment"]);
                    }
                } else {
                    try {
                        this.getView().addDependent(this[fragmentName + "_fragment"]); // genera una excepción
                    } catch (err) {
                        // sentencias para manejar cualquier excepción
                        this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                            this);
                        this.getView().addDependent(this[fragmentName + "_fragment"]);
                    }
                }
                return this[fragmentName + "_fragment"];
            },

            /**
            * The selected sort configuration is applied to the table.
            * @param {object} oEvent event
            */
            onSortConfirm: function (oEvent) {
                let oTable = this.getView().byId("mainTable");
                let mParams = oEvent.getParameters();
                let oBinding = oTable.getBinding("items");
                let sPath;
                let bDescending;
                let aSorters = [];

                sPath = mParams.sortItem.getKey();
                bDescending = mParams.sortDescending;

                if (sPath) {
                    aSorters.push(new Sorter(sPath, bDescending));
                }
                // Apply the selected sort settings
                oBinding.sort(aSorters);
            },

            /**
            * Exports table data in csv format.
            */
            onDataExport: function () {

                let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
                let oExport = new Export({
    
                    // Type that will be used to generate the content. Own ExportType's can be created to support other formats
                    exportType: new ExportTypeCSV({
                        separatorChar: ";"
                    }),
    
                    // Pass in the main model
                    models: this.getView().getModel(this.mainModel),
    
                    // binding information for the rows aggregation
                    rows: {
                        path: "/results"
                    },
    
                    // column definitions with column name and binding info for the content
                    columns: [{
                        name: "ProductID",
                        template: {
                            content: "{ProductID}"
                        }
                    }, {
                        name: "TypeCode",
                        template: {
                            content: "{TypeCode}"
                        }
                    }, {
                        name: "Category",
                        template: {
                            content: "{Category}"
                        }
                    }, {
                        name: "Name",
                        template: {
                            content: "{Name}"
                        }
                    }]
                });
    
                // Download exported file
                oExport.saveFile("ListadoProductos").catch(function (oError) {
                    MessageBox.error(resourceBundle.getText("exportError") + ":\n\n" + oError);
                }).then(function () {
                    oExport.destroy();
                });    
            },

            onProductDetail: function (oEvent) {
                let oItem = oEvent.getParameter("listItem") || oEvent.getSource();
                let oCtx = oItem.getBindingContext("mainModel");
                let sPath = oCtx ? oCtx.getPath() : undefined;
                let rowData = this.getView().byId("mainTable").getModel("mainModel").getProperty(sPath);

                let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("productDetail", {
                    "ProductID": rowData.ProductID,
                });

                oRouter.navTo("Details", {
                     productId: rowData.productId,
                 });
            },

            /**
		    * Select columns button press
		    * @param {object} oEvent event
		    */
            onSelectColumnsPressed: function () {
                let columnsSelectionDialog = this._getFragment(this.columnsSelectionDialog);
                let mainTable = this.byId("mainTable");

                this._setColumnsModel(mainTable);
                columnsSelectionDialog.open();
            },

            /**
		    * Function that creates the model for the p13n functionality for a given table columns.
		    * @param {object} table sapui5 table component from wich we want to create the model.
		    */
            _setColumnsModel: function (table) {

                let columns = table.getColumns();
                let data = [];

                for (let co of columns) {

                    let text = co.getHeader().getText();
                    let id = co.data().columnId;
                    let found = false;

                    if (this.userCols.includes(id)) found = true;

                    //Validation that discards buttons columns without column label.
                    if (text) {
                        data.push({
                            text: text,
                            selectedId: id,
                            selected: found
                        });
                    }

                }
                this.getView().getModel(this.colsP13nModel).setData(data);
            },

            /**
             * Event fired when pressing the "Apply" button on the p13n dialog.
             * @param {object} oEvent event
             */
            onApplyP13n: function (oEvent) {
                let data = this._getP13nDataToSend();
                let dialog = oEvent.getSource().getParent();

                if (data) {
                    this.userCols = data.columnConfig;
                } else {
                    this.userCols = this.defaultMainTableCols;
                }
                
                this._setTableColumns(this.userCols);
                dialog.close();                          
            },

            /**
		    * Event fired when pressing the "Cancel" button on the p13n dialog.
		    * @param {object} oEvent event
		    */
            onCancelP13n: function (oEvent) {
                let dialog = oEvent.getSource().getParent();
                dialog.close();
            },

            /**
		    * Function that created the data to be sent to backend to store the p13n for each user.
		    * @return {object} data to be sent to backend SCP.
		    */
            _getP13nDataToSend: function () {

                let p13nData = this.getView().getModel(this.colsP13nModel).getData();
                let dataToSend = {
                    idTable: "mainTable",
                    columnConfig: []
                };

                for (let p13 of p13nData) {
                    if (p13.selected) {
                        dataToSend.columnConfig.push(p13.selectedId);
                    }
                }

                dataToSend.columnConfig = JSON.stringify(dataToSend.columnConfig);

                return dataToSend;

            },

            /**
		    * Function that sets the default columns selection for a table.
		    * @param {Array} userCols array of strings, where each string indicates the id of the column to be shown.
		    */
            _setTableColumns: function (userCols) {

                let mainTable = this.byId("mainTable");
                let tableCols = mainTable.getColumns();

                //Columns for both buttons are obtained from the last positions of the table.
                let detailButtonCol = tableCols[tableCols.length - 1];
                for (let tc of tableCols) {
                    let found = false;
                    let id = tc.data().columnId;

                    if (userCols.includes(id)) found = true;
                    tc.setVisible(found);
                }
                detailButtonCol.setVisible(true);
            },

            /**
		    * Function to read user columns data from DataTableConfigService OData.
		    */
            _getUserColumns: function () {

                this.userCols = this.defaultMainTableCols;
                this._setTableColumns(this.userCols);
            }
        });
    });

